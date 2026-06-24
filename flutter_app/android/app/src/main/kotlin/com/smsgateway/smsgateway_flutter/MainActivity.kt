package com.smsgateway.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Enregistre le canal SMS sur le moteur de l'UI (envoi manuel).
        // Le meme canal est aussi enregistre sur le moteur du service
        // d'arriere-plan via MyApplication / FlutterForegroundTaskLifecycleListener.
        SmsChannel.register(this, flutterEngine.dartExecutor.binaryMessenger)
    }
}
