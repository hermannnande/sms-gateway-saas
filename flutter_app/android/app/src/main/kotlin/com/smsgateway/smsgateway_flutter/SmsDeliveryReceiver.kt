package com.smsgateway.app

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.net.Uri
import android.os.Build
import android.telephony.SmsMessage
import android.util.Log
import org.json.JSONArray
import java.security.MessageDigest
import java.util.UUID

/** Explicit receiver remains available after the Flutter engine/process exits. */
class SmsDeliveryReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val uri = intent.data ?: return
        if (uri.scheme != "smsenvoie-delivery" || uri.pathSegments.size != 1) return
        val attempt = uri.host ?: return
        val part = uri.pathSegments[0].toIntOrNull() ?: return
        // RESULT_OK alone isn't a delivery receipt. Decode the operator PDU.
        val pdu = intent.getByteArrayExtra("pdu") ?: return
        val format = intent.getStringExtra("format") ?: return
        val state = try {
            val sms = SmsMessage.createFromPdu(pdu, format) ?: return
            if (!sms.isStatusReportMessage) return
            DeliveryStatus.fromNetwork(sms.status, format)
        } catch (_: Exception) { return }
        val pending = goAsync()
        Thread {
            try { DeliveryStore.get(context).record(attempt, part, state) }
            catch (e: Exception) { Log.e("SMS_DELIVERY", "Could not persist receipt", e) }
            finally { pending.finish() }
        }.start()
    }
}

/** SQLite avoids rewriting a 25,000-message JSON document after every SMS.
 * Token hashes isolate accounts; no phone numbers, message bodies or tokens are stored.
 */
class DeliveryStore private constructor(context: Context) : SQLiteOpenHelper(context, "sms-delivery.db", null, 1) {
    companion object {
        @Volatile private var instance: DeliveryStore? = null
        fun get(context: Context): DeliveryStore = instance ?: synchronized(this) {
            instance ?: DeliveryStore(context.applicationContext).also { instance = it }
        }
        private fun hash(token: String) = MessageDigest.getInstance("SHA-256")
            .digest(token.trim().toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE receipts (
            attempt TEXT PRIMARY KEY, message TEXT NOT NULL, owner TEXT NOT NULL,
            parts TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending',
            ready INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1,
            acknowledged INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)""")
        db.execSQL("CREATE INDEX receipts_owner ON receipts(owner, ready, acknowledged)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    @Synchronized fun create(context: Context, message: String, token: String, count: Int): Pair<String, ArrayList<PendingIntent>> {
        UUID.fromString(message)
        val attempt = UUID.randomUUID().toString()
        val parts = JSONArray().also { a -> repeat(count) { a.put("pending") } }
        writableDatabase.insertOrThrow("receipts", null, ContentValues().apply {
            put("attempt", attempt); put("message", message); put("owner", hash(token))
            put("parts", parts.toString()); put("created", System.currentTimeMillis())
        })
        val intents = ArrayList<PendingIntent>(count)
        repeat(count) { index ->
            val intent = Intent(context, SmsDeliveryReceiver::class.java)
                .setAction("${context.packageName}.SMS_DELIVERED")
                .setData(Uri.parse("smsenvoie-delivery://$attempt/$index"))
            // Mutable is necessary for telephony to attach pdu + format. The
            // component and data are explicit; the receiver is not exported.
            val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
            intents.add(PendingIntent.getBroadcast(context, 0, intent, flags))
        }
        return Pair(attempt, intents)
    }

    @Synchronized fun sent(attempt: String) {
        writableDatabase.execSQL("UPDATE receipts SET ready=1 WHERE attempt=?", arrayOf(attempt))
    }

    @Synchronized fun sendFailed(attempt: String) {
        // Keep evidence of complete delivery if it arrived before SENT/timeout.
        writableDatabase.delete("receipts", "attempt=? AND state<>'delivered'", arrayOf(attempt))
    }

    @Synchronized fun record(attempt: String, index: Int, incoming: String) {
        writableDatabase.query("receipts", arrayOf("parts", "state"), "attempt=?", arrayOf(attempt), null, null, null).use { cursor ->
            if (!cursor.moveToFirst()) return
            val parts = JSONArray(cursor.getString(0))
            if (index !in 0 until parts.length()) return
            val previous = parts.getString(index)
            val merged = DeliveryStatus.merge(previous, incoming)
            if (previous == merged) return
            parts.put(index, merged)
            val state = DeliveryStatus.aggregate((0 until parts.length()).map { parts.getString(it) })
            writableDatabase.execSQL(
                "UPDATE receipts SET parts=?, state=?, revision=revision+1, ready=CASE WHEN ?='delivered' THEN 1 ELSE ready END WHERE attempt=?",
                arrayOf(parts.toString(), state, state, attempt))
        }
    }

    @Synchronized fun pending(token: String): List<Map<String, Any>> {
        val rows = mutableListOf<Map<String, Any>>()
        readableDatabase.query("receipts", arrayOf("attempt", "message", "state", "revision"),
            "owner=? AND ready=1 AND revision>acknowledged", arrayOf(hash(token)), null, null, "created ASC", "50").use { cursor ->
            while (cursor.moveToNext()) rows.add(mapOf(
                "attempt_id" to cursor.getString(0), "message_id" to cursor.getString(1),
                "status" to cursor.getString(2), "revision" to cursor.getInt(3)))
        }
        return rows
    }

    @Synchronized fun acknowledge(token: String, reports: List<Map<*, *>>, rejected: Boolean) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (r in reports) {
                val attempt = r["attempt_id"] as? String ?: continue
                val revision = (r["revision"] as? Number)?.toInt() ?: continue
                if (rejected) db.delete("receipts", "attempt=? AND owner=?", arrayOf(attempt, hash(token)))
                else db.execSQL("UPDATE receipts SET acknowledged=MAX(acknowledged, ?) WHERE attempt=? AND owner=?",
                    arrayOf(revision, attempt, hash(token)))
            }
            // Never discard an unsynchronized report. Old pending receipts stay
            // unknown on the server; a timeout is NOT proof of non-delivery.
            db.delete("receipts", "created<? AND (revision=acknowledged OR ready=0)",
                arrayOf((System.currentTimeMillis() - 30L * 24 * 60 * 60 * 1000).toString()))
            db.setTransactionSuccessful()
        } finally { db.endTransaction() }
    }
}
