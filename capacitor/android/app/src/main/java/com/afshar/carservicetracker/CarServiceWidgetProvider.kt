package com.afshar.carservicetracker

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.view.View
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.abs

class CarServiceWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        appWidgetIds.forEach { widgetId ->
            appWidgetManager.updateAppWidget(widgetId, buildViews(context))
        }
    }

    companion object {
        const val PREFERENCES_NAME = "car_widget_state"
        const val KEY_ESTIMATED_MILEAGE = "estimated_mileage_km"
        const val KEY_REMAINING_KM = "remaining_km"
        const val KEY_STATUS = "status"
        const val KEY_UPDATED_AT = "updated_at"

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val provider = ComponentName(context, CarServiceWidgetProvider::class.java)
            manager.updateAppWidget(provider, buildViews(context))
        }

        private fun buildViews(context: Context): RemoteViews {
            val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
            val mileage = preferences.getLong(KEY_ESTIMATED_MILEAGE, -1)
            val remaining = preferences.getLong(KEY_REMAINING_KM, Long.MIN_VALUE)
            val status = preferences.getString(KEY_STATUS, "not-configured")
            val formatter = NumberFormat.getIntegerInstance(Locale.US)

            return RemoteViews(context.packageName, R.layout.car_service_widget).apply {
                setTextViewText(
                    R.id.widget_mileage,
                    if (mileage >= 0) "${formatter.format(mileage)} km" else "Open app",
                )
                setTextViewText(
                    R.id.widget_mileage_label,
                    if (mileage >= 0) "Estimated mileage" else "Add your first mileage reading",
                )

                when {
                    status == "overdue" && remaining != Long.MIN_VALUE -> {
                        setTextViewText(R.id.widget_service_status, "SERVICE DUE · ${formatter.format(abs(remaining))} km overdue")
                        setViewVisibility(R.id.widget_service_status, View.VISIBLE)
                        setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background_overdue)
                    }
                    remaining != Long.MIN_VALUE -> {
                        val prefix = if (status == "due-soon") "Due soon · " else ""
                        setTextViewText(R.id.widget_service_status, "${prefix}Service in ~${formatter.format(remaining)} km")
                        setViewVisibility(R.id.widget_service_status, View.VISIBLE)
                        setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background)
                    }
                    else -> {
                        setTextViewText(R.id.widget_service_status, "Set up your service interval")
                        setViewVisibility(R.id.widget_service_status, View.VISIBLE)
                        setInt(R.id.widget_root, "setBackgroundResource", R.drawable.widget_background)
                    }
                }

                val openApp = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
                }
                val pendingIntent = PendingIntent.getActivity(
                    context,
                    0,
                    openApp,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                setOnClickPendingIntent(R.id.widget_root, pendingIntent)
            }
        }
    }
}
