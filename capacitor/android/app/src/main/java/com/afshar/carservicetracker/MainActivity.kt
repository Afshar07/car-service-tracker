package com.afshar.carservicetracker

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(CarWidgetPlugin::class.java)
        registerPlugin(MileageBackupPlugin::class.java)
        registerPlugin(MlKitOcrPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
