package expo.modules.scamshield

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

// Settings the call and SMS checks need while the app itself is closed.
// Message text is never saved here, only the sender, the verdict and the reason.
class ShieldSettings(context: Context) {
  private val prefs = context.getSharedPreferences("scam_shield", Context.MODE_PRIVATE)

  var apiUrl: String
    get() = prefs.getString("api_url", "") ?: ""
    set(value) {
      prefs.edit().putString("api_url", value.trimEnd('/')).commit()
    }

  var callsEnabled: Boolean
    get() = prefs.getBoolean("calls_enabled", false)
    set(value) {
      prefs.edit().putBoolean("calls_enabled", value).commit()
    }

  var smsEnabled: Boolean
    get() = prefs.getBoolean("sms_enabled", false)
    set(value) {
      prefs.edit().putBoolean("sms_enabled", value).commit()
    }

  var skipContacts: Boolean
    get() = prefs.getBoolean("skip_contacts", false)
    set(value) {
      prefs.edit().putBoolean("skip_contacts", value).commit()
    }

  // When Android last asked this app to check a call. Shows the user that call checking really runs.
  var lastCallCheckedAt: Long
    get() = prefs.getLong("last_call_checked_at", 0L)
    set(value) {
      prefs.edit().putLong("last_call_checked_at", value).apply()
    }

  // Show the warning card on top of the call screen / other apps (needs "Display over other apps").
  var popupEnabled: Boolean
    get() = prefs.getBoolean("popup_enabled", true)
    set(value) {
      prefs.edit().putBoolean("popup_enabled", value).commit()
    }

  var callAction: String
    get() = prefs.getString("call_action", ACTION_WARN) ?: ACTION_WARN
    set(value) {
      prefs.edit().putString("call_action", value).commit()
    }

  // Approved scam numbers from the server, saved as "number|reports", e.g. "+250788444999|3".
  fun saveScamNumbers(numbers: List<String>, reports: List<Int>) {
    val entries = numbers.mapIndexed { index, number ->
      PhoneNumbers.normalize(number) + "|" + reports.getOrElse(index) { 0 }
    }.toSet()
    prefs.edit()
      .putStringSet("scam_numbers", entries)
      .putLong("numbers_synced_at", System.currentTimeMillis())
      .commit()
  }

  // How many people reported this number, or null if it is not a known scam number.
  fun reportsFor(number: String): Int? {
    val wanted = PhoneNumbers.normalize(number)
    val entries = prefs.getStringSet("scam_numbers", null) ?: return null
    for (entry in entries) {
      val parts = entry.split("|")
      if (parts[0] == wanted) return parts.getOrNull(1)?.toIntOrNull() ?: 0
    }
    return null
  }

  val scamNumberCount: Int
    get() = prefs.getStringSet("scam_numbers", null)?.size ?: 0

  val numbersSyncedAt: Long
    get() = prefs.getLong("numbers_synced_at", 0L)

  // Newest alert first, at most MAX_HISTORY of them.
  fun addAlert(alert: JSONObject) {
    synchronized(LOCK) {
      val old = history()
      val updated = JSONArray().put(alert)
      for (i in 0 until minOf(old.length(), MAX_HISTORY - 1)) updated.put(old.get(i))
      prefs.edit().putString("history", updated.toString()).commit()
    }
  }

  fun history(): JSONArray {
    return try {
      JSONArray(prefs.getString("history", "[]"))
    } catch (error: Exception) {
      JSONArray()
    }
  }

  fun clearHistory() {
    synchronized(LOCK) {
      prefs.edit().remove("history").commit()
    }
  }

  companion object {
    const val ACTION_WARN = "warn"
    const val ACTION_SILENCE = "silence"
    const val ACTION_BLOCK = "block"
    const val MAX_HISTORY = 50
    private val LOCK = Any()
  }
}
