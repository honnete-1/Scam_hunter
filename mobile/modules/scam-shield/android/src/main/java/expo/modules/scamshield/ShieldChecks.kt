package expo.modules.scamshield

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.ContactsContract
import androidx.core.content.ContextCompat
import org.json.JSONObject

// What was found about an incoming call or SMS. level is null when there is nothing to warn about.
data class Decision(val level: String?, val reason: String, val saferAction: String, val headline: String = "")

// The real-time checks. They always run on a background thread.
object ShieldChecks {
  // Android gives a call-screening app about 5 seconds, so the network check must be quick.
  private const val CALL_TIMEOUT_MS = 3000
  // Leaves time for the AI check and the translation, within Android's 10 seconds for an SMS receiver.
  private const val SMS_TIMEOUT_MS = 9000
  private val NOTHING = Decision(null, "", "")

  fun checkCall(context: Context, number: String): Decision {
    val settings = ShieldSettings(context)
    // 1. The saved list of approved scam numbers answers instantly, even offline.
    val reports = settings.reportsFor(number)
    if (reports != null) {
      return Decision(ScamApi.HIGH_CONCERN, reportedText(reports), "Don't share codes or PINs, and don't send money to this caller.")
    }
    // 2. Otherwise ask the backend, which also applies the phone-number rules.
    val verdict = ScamApi.checkPhone(settings.apiUrl, number, CALL_TIMEOUT_MS)
    if (verdict != null && isWarning(verdict.concernLevel)) {
      return Decision(verdict.concernLevel, verdict.explanation, verdict.saferAction, verdict.headline)
    }
    return NOTHING
  }

  fun checkSms(context: Context, sender: String, body: String, checkText: Boolean = true): Decision {
    val settings = ShieldSettings(context)
    val reports = if (PhoneNumbers.isPhoneNumber(sender)) settings.reportsFor(sender) else null
    // flagged is null unless the backend found warning signs in the text.
    val flagged = if (!checkText) null
      else ScamApi.checkMessage(settings.apiUrl, body, SMS_TIMEOUT_MS)?.takeIf { isWarning(it.concernLevel) }

    if (reports != null) {
      val extra = if (flagged != null) " " + flagged.explanation else ""
      val action = flagged?.saferAction?.takeIf { it.isNotBlank() } ?: "Don't reply, open links or send money."
      return Decision(ScamApi.HIGH_CONCERN, reportedText(reports) + extra, action)
    }
    if (flagged != null) return Decision(flagged.concernLevel, flagged.explanation, flagged.saferAction, flagged.headline)
    return NOTHING
  }

  // Saves the alert on the phone (without the message text), shows the notification and the pop-up card.
  fun alert(context: Context, kind: String, sender: String, decision: Decision, actionTaken: String) {
    val level = decision.level ?: return
    val high = level == ScamApi.HIGH_CONCERN
    val what = if (kind == "CALL") "call" else "SMS"
    val blocked = kind == "CALL" && actionTaken == ShieldSettings.ACTION_BLOCK
    val title = when {
      blocked -> "Blocked a scam call from $sender"
      decision.headline.isNotBlank() -> decision.headline
      high -> "Scam warning: $what from $sender"
      else -> "Be careful: $what from $sender"
    }
    val subtitle = (if (kind == "CALL") "Incoming call from " else "SMS from ") + sender
    val details = listOf(decision.reason, decision.saferAction).filter { it.isNotBlank() }.joinToString("\n")
    // When the title is the backend's headline, the sender goes on the first line instead.
    val text = if (decision.headline.isNotBlank() && !blocked) subtitle + "\n" + details else details

    val entry = JSONObject()
    entry.put("kind", kind)
    entry.put("sender", sender)
    entry.put("level", level)
    entry.put("reason", decision.reason)
    entry.put("saferAction", decision.saferAction)
    entry.put("action", actionTaken)
    entry.put("at", System.currentTimeMillis())
    ShieldSettings(context).addAlert(entry)

    val reportNumber = if (PhoneNumbers.isPhoneNumber(sender)) sender else null
    ShieldNotifications.show(context, title, text, reportNumber)

    // A blocked call never rings, so there is no call screen to cover.
    if (!blocked && ShieldSettings(context).popupEnabled) {
      val cardTitle = if (decision.headline.isNotBlank()) decision.headline else if (high) "Possible scam $what" else "Be careful with this $what"
      WarningOverlay.show(context, high, cardTitle, subtitle, decision.reason, decision.saferAction, reportNumber)
    }
  }

  // True when the number is in the user's contacts and the app was allowed to look.
  fun isSavedContact(context: Context, number: String): Boolean {
    val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS)
    if (permission != PackageManager.PERMISSION_GRANTED || !PhoneNumbers.isPhoneNumber(number)) return false
    return try {
      val uri = Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number))
      val cursor = context.contentResolver.query(uri, arrayOf(ContactsContract.PhoneLookup._ID), null, null, null)
      cursor?.use { it.count > 0 } ?: false
    } catch (error: Exception) {
      false
    }
  }

  private fun isWarning(level: String) = level == ScamApi.HIGH_CONCERN || level == ScamApi.CAUTION

  private fun reportedText(reports: Int): String = when (reports) {
    0 -> "This number is on Scam Hunter's list of known scam numbers."
    1 -> "Reported as a scam by 1 person and confirmed by a moderator."
    else -> "Reported as a scam by $reports people and confirmed by a moderator."
  }
}
