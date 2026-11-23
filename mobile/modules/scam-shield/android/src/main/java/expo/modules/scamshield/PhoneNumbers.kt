package expo.modules.scamshield

// Same rules as the backend's normalize_phone_number(), so the phone and the server agree on a number.
object PhoneNumbers {
  private val SEPARATORS = Regex("""[\s\-.()]""")
  private val RWANDA_LOCAL_MOBILE = Regex("""^07[2389]\d{7}$""")
  private val RWANDA_MOBILE_WITHOUT_PLUS = Regex("""^2507[2389]\d{7}$""")
  private val PHONE_PATTERN = Regex("""^\+?\d{7,15}$""")

  fun normalize(raw: String): String {
    var cleaned = raw.trim().replace(SEPARATORS, "")
    if (cleaned.startsWith("00")) cleaned = "+" + cleaned.substring(2)
    if (RWANDA_LOCAL_MOBILE.matches(cleaned)) {
      cleaned = "+250" + cleaned.substring(1)
    } else if (RWANDA_MOBILE_WITHOUT_PLUS.matches(cleaned)) {
      cleaned = "+$cleaned"
    }
    return cleaned
  }

  // SMS can come from names like "MTN" or "BK"; those cannot be checked or reported as numbers.
  fun isPhoneNumber(raw: String): Boolean = PHONE_PATTERN.matches(normalize(raw))
}
