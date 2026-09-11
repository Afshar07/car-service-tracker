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

@CapacitorPlugin(name = "CarWidget")
class CarWidgetPlugin : Plugin() {
    @PluginMethod
    fun update(call: PluginCall) {
        val preferences = context.getSharedPreferences(
            CarServiceWidgetProvider.PREFERENCES_NAME,
            android.content.Context.MODE_PRIVATE,
        )

        preferences.edit()
            .putLong(CarServiceWidgetProvider.KEY_ESTIMATED_MILEAGE, call.getLong("estimatedMileageKm") ?: -1)
            .putLong(CarServiceWidgetProvider.KEY_REMAINING_KM, call.getLong("remainingKm") ?: Long.MIN_VALUE)
            .putString(CarServiceWidgetProvider.KEY_STATUS, call.getString("status", "not-configured"))
            .putString(CarServiceWidgetProvider.KEY_UPDATED_AT, call.getString("updatedAt", ""))
            .apply()

        CarServiceWidgetProvider.updateAll(context)
        call.resolve()
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
