package expo.modules.scamshield

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony

// Receives each new SMS from the phone system. It cannot read the inbox (READ_SMS is blocked),
// and the message text is only sent to the backend for checking, never saved.
class SmsScamReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
    val settings = ShieldSettings(context)
    if (!settings.smsEnabled) return

    val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent)
    if (parts.isNullOrEmpty()) return
    val sender = parts[0].originatingAddress ?: return
    // Long SMS arrive in several parts; join them back into one message.
    val body = parts.joinToString("") { it.messageBody ?: "" }
    if (body.isBlank()) return
    // "Skip my contacts" only skips the text check: a reported scam number always gets a warning,
    // even when it is saved as a contact.
    val checkText = !(settings.skipContacts && ShieldChecks.isSavedContact(context, sender))
    if (!checkText && settings.reportsFor(sender) == null) return

    // goAsync keeps the receiver alive while the network check runs (Android allows about 10 s).
    val pending = goAsync()
    val appContext = context.applicationContext
    Thread {
      try {
        val decision = ShieldChecks.checkSms(appContext, sender, body, checkText)
        ShieldChecks.alert(appContext, "SMS", sender, decision, ShieldSettings.ACTION_WARN)
      } catch (error: Exception) {
        // A failed check shows nothing; it is never reported as safe.
      } finally {
        pending.finish()
      }
    }.start()
  }
}
