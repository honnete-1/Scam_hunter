package expo.modules.scamshield

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

// What the backend said about a number or message.
data class Verdict(
  val concernLevel: String,
  // Short title from the backend, already in the message's language when it is not English.
  val headline: String,
  val explanation: String,
  val saferAction: String,
  val approvedReports: Int
)

// Calls the same Django check endpoints as the app's screens. Nothing is stored by the server.
object ScamApi {
  const val HIGH_CONCERN = "HIGH_CONCERN"
  const val CAUTION = "CAUTION"

  fun checkPhone(apiUrl: String, number: String, timeoutMs: Int): Verdict? =
    post("$apiUrl/api/check/phone/", "phone_number", number, timeoutMs)

  fun checkMessage(apiUrl: String, message: String, timeoutMs: Int): Verdict? =
    post("$apiUrl/api/check/message/", "message", message, timeoutMs)

  // Returns null when the check could not be done (offline, timeout, invalid input).
  // A failed check is never treated as "safe"; the caller simply shows nothing new.
  private fun post(url: String, field: String, value: String, timeoutMs: Int): Verdict? {
    if (!url.startsWith("http")) return null
    var connection: HttpURLConnection? = null
    try {
      connection = URL(url).openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.connectTimeout = timeoutMs / 2
      connection.readTimeout = timeoutMs
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.setRequestProperty("Accept", "application/json")

      val body = JSONObject().put(field, value).toString()
      connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }

      if (connection.responseCode != 200) return null
      val text = connection.inputStream.bufferedReader().use { it.readText() }
      val json = JSONObject(text)
      val level = json.optString("concern_level", "")
      if (level.isEmpty() || level == "null") return null

      val reputation = json.optJSONObject("reputation")
      return Verdict(
        concernLevel = level,
        headline = json.optString("headline", ""),
        explanation = json.optString("explanation", ""),
        saferAction = json.optString("safer_action", ""),
        approvedReports = reputation?.optInt("approved_reports", 0) ?: 0
      )
    } catch (error: Exception) {
      return null
    } finally {
      connection?.disconnect()
    }
  }
}
