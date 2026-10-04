package com.afshar.carservicetracker

import android.content.ClipData
import android.content.Intent
import android.util.AtomicFile
import androidx.core.content.FileProvider
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File

@CapacitorPlugin(name = "MileageBackup")
class MileageBackupPlugin : Plugin() {
    private fun backupFile() = AtomicFile(File(context.filesDir, "mileage-history.json"))

    @PluginMethod
    @Synchronized
    fun read(call: PluginCall) {
        try {
            val file = backupFile()
            val result = JSObject()
            if (file.baseFile.exists() || File(file.baseFile.path + ".bak").exists()) {
                result.put("json", file.openRead().use { it.readBytes().toString(Charsets.UTF_8) })
            }
            call.resolve(result)
        } catch (error: Exception) {
            call.reject("Could not read the automatic mileage backup", error)
        }
    }

    @PluginMethod
    @Synchronized
    fun write(call: PluginCall) {
        val json = call.getString("json") ?: run {
            call.reject("Missing mileage backup")
            return
        }
        val file = backupFile()
        var stream: java.io.FileOutputStream? = null
        try {
            stream = file.startWrite()
            stream.write(json.toByteArray(Charsets.UTF_8))
            file.finishWrite(stream)
            call.resolve()
        } catch (error: Exception) {
            file.failWrite(stream)
            call.reject("Could not save the automatic mileage backup", error)
        }
    }

    @PluginMethod
    fun share(call: PluginCall) {
        val json = call.getString("json") ?: run {
            call.reject("Missing mileage export")
            return
        }
        val filename = call.getString("filename") ?: "mileage-history.json"
        if (!filename.matches(Regex("mileage-history[-0-9TZ]*\\.json"))) {
            call.reject("Invalid export filename")
            return
        }
        try {
            val directory = File(context.cacheDir, "mileage-exports").apply { mkdirs() }
            val file = File(directory, filename)
            file.writeText(json, Charsets.UTF_8)
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/json"
                putExtra(Intent.EXTRA_STREAM, uri)
                clipData = ClipData.newRawUri("Mileage history", uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(Intent.createChooser(intent, "Export mileage history"))
            call.resolve()
        } catch (error: Exception) {
            call.reject("Could not share mileage history", error)
        }
    }
}
