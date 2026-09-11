package com.afshar.carservicetracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlin.math.roundToLong

@CapacitorPlugin(name = "CarWidget")
class CarWidgetPlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        // JavaScript numbers arrive as Integer or Double. PluginCall.getLong()
        // accepts only an actual Long, so it silently returned the fallback.
        val estimatedMileage = call.getDouble("estimatedMileageKm")?.roundToLong() ?: -1L
        val remainingKm = call.getDouble("remainingKm")?.roundToLong() ?: Long.MIN_VALUE
        val status = call.getString("status", "not-configured") ?: "not-configured"
        val updatedAt = call.getString("updatedAt", "") ?: ""

        val preferences = context.getSharedPreferences(
            CarServiceWidgetProvider.PREFERENCES_NAME,
            android.content.Context.MODE_PRIVATE,
        )

        val persisted = preferences.edit()
            .putLong(CarServiceWidgetProvider.KEY_ESTIMATED_MILEAGE, estimatedMileage)
            .putLong(CarServiceWidgetProvider.KEY_REMAINING_KM, remainingKm)
            .putString(CarServiceWidgetProvider.KEY_STATUS, status)
            .putString(CarServiceWidgetProvider.KEY_UPDATED_AT, updatedAt)
            .commit()

        if (!persisted) {
            call.reject("Could not persist widget state")
            return
        }

        CarServiceWidgetProvider.updateAll(context)
        call.resolve(
            JSObject()
                .put("estimatedMileageKm", estimatedMileage)
                .put("remainingKm", remainingKm)
                .put("status", status)
                .put("updatedAt", updatedAt),
        )
    }

    @PluginMethod
    fun requestPin(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(JSObject().put("supported", false).put("requested", false))
            return
        }

        val manager = AppWidgetManager.getInstance(context)
        val provider = ComponentName(context, CarServiceWidgetProvider::class.java)
        if (!manager.isRequestPinAppWidgetSupported) {
            call.resolve(JSObject().put("supported", false).put("requested", false))
            return
        }

        val callbackIntent = Intent(context, CarServiceWidgetProvider::class.java).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        }
        val callback = PendingIntent.getBroadcast(
            context,
            0,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val requested = manager.requestPinAppWidget(provider, null, callback)
        call.resolve(JSObject().put("supported", true).put("requested", requested))
    }
}
