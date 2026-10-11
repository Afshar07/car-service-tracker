package com.afshar.carservicetracker

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

@CapacitorPlugin(name = "MlKitOcr")
class MlKitOcrPlugin : Plugin() {
    private val recognizerDelegate = lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private val recognizer by recognizerDelegate

    // ML Kit gains nothing above this; full-resolution crops from large photos would exhaust memory.
    private fun decodeBounded(bytes: ByteArray): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sampleSize = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sampleSize > MAX_EDGE_PX) sampleSize *= 2
        val options = BitmapFactory.Options().apply { inSampleSize = sampleSize }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    }

    @PluginMethod
    fun recognize(call: PluginCall) {
        val encoded = call.getString("image") ?: run {
            call.reject("Missing image")
            return
        }
        val bitmap = try {
            decodeBounded(Base64.decode(encoded, Base64.DEFAULT))
        } catch (error: IllegalArgumentException) {
            null
        } catch (error: OutOfMemoryError) {
            null
        } ?: run {
            call.reject("The image could not be decoded")
            return
        }
        recognizer.process(InputImage.fromBitmap(bitmap, 0))
            .addOnSuccessListener { result ->
                bitmap.recycle()
                call.resolve(JSObject().put("text", result.text))
            }
            .addOnFailureListener { error ->
                bitmap.recycle()
                call.reject("Text recognition failed", error)
            }
    }

    override fun handleOnDestroy() {
        if (recognizerDelegate.isInitialized()) recognizer.close()
        super.handleOnDestroy()
    }

    private companion object {
        const val MAX_EDGE_PX = 2048
    }
}
