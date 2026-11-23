package expo.modules.scamshield

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

// Shows scam warnings as high-priority notifications, so they pop up even during an incoming call.
object ShieldNotifications {
  private const val CHANNEL_ID = "scam_alerts"
  private const val APP_SCHEME = "scamhunter"
  private val WARNING_RED = 0xFFC62828.toInt()

  fun canNotify(context: Context): Boolean =
    NotificationManagerCompat.from(context).areNotificationsEnabled()

  fun show(context: Context, title: String, text: String, reportNumber: String?) {
    if (!canNotify(context)) return
    createChannel(context)

    // Different ids so a new warning never replaces an older one.
    val id = ((System.currentTimeMillis() / 100) % 1_000_000).toInt() * 2
    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(R.drawable.scam_shield_notification)
      .setColor(WARNING_RED)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setAutoCancel(true)
      .setContentIntent(openApp(context, id, "$APP_SCHEME://protection"))

    if (reportNumber != null) {
      val link = "$APP_SCHEME://report?type=PHONE&content=" + Uri.encode(reportNumber)
      builder.addAction(0, "Report number", openApp(context, id + 1, link))
    }

    try {
      NotificationManagerCompat.from(context).notify(id, builder.build())
    } catch (error: SecurityException) {
      // The notification permission was removed in the meantime; nothing else to do.
    }
  }

  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channel = NotificationChannel(CHANNEL_ID, "Scam alerts", NotificationManager.IMPORTANCE_HIGH)
    channel.description = "Warnings about suspicious calls and SMS"
    channel.enableVibration(true)
    val manager = context.getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(channel)
  }

  private fun openApp(context: Context, requestCode: Int, link: String): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val flags = PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    return PendingIntent.getActivity(context, requestCode, intent, flags)
  }
}
