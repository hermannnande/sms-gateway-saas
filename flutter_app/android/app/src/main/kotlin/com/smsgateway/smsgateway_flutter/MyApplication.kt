package com.smsgateway.app

import android.app.Application
import android.util.Log
import com.pravera.flutter_foreground_task.FlutterForegroundTaskLifecycleListener
import com.pravera.flutter_foreground_task.FlutterForegroundTaskPlugin
import com.pravera.flutter_foreground_task.FlutterForegroundTaskStarter
import io.flutter.embedding.engine.FlutterEngine

/**
 * Application personnalisee.
 *
 * Son seul role est d'enregistrer le canal natif d'envoi de SMS sur le
 * FlutterEngine cree par flutter_foreground_task pour le service d'arriere-plan.
 *
 * Sans cela, le moteur d'arriere-plan (totalement separe de celui de
 * MainActivity) ne connait pas le canal "com.smsgateway.app/sms" et tout envoi
 * de SMS depuis une campagne en arriere-plan echoue avec MissingPluginException
 * -> aucun SMS n'est reellement envoye.
 */
class MyApplication : Application() {
    private val taskLifecycleListener = object : FlutterForegroundTaskLifecycleListener {
        override fun onEngineCreate(flutterEngine: FlutterEngine?) {
            val engine = flutterEngine ?: return
            try {
                SmsChannel.register(this@MyApplication, engine.dartExecutor.binaryMessenger)
                Log.d("SMS_GATEWAY", "SmsChannel registered on background engine")
            } catch (e: Exception) {
                Log.e("SMS_GATEWAY", "Failed to register SmsChannel on background engine", e)
            }
        }

        override fun onTaskStart(starter: FlutterForegroundTaskStarter) {}
        override fun onTaskRepeatEvent() {}
        override fun onTaskDestroy() {}
        override fun onEngineWillDestroy() {}
    }

    override fun onCreate() {
        super.onCreate()
        FlutterForegroundTaskPlugin.addTaskLifecycleListener(taskLifecycleListener)
    }
}
