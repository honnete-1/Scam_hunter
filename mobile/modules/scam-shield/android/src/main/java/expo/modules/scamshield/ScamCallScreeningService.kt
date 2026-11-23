package expo.modules.scamshield

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.CallScreeningService.CallResponse

// Android hands incoming calls from unknown numbers to this service before the phone rings.
// Only the caller's number is checked; call audio is never touched.
class ScamCallScreeningService : CallScreeningService() {
  override fun onScreenCall(callDetails: Call.Details) {
    val settings = ShieldSettings(this)
    val number = callDetails.handle?.schemeSpecificPart
    val incoming = Build.VERSION.SDK_INT < Build.VERSION_CODES.Q ||
      callDetails.callDirection == Call.Details.DIRECTION_INCOMING

    if (!settings.callsEnabled || !incoming || number.isNullOrBlank()) {
      respondToCall(callDetails, CallResponse.Builder().build())
      return
    }

    val context = applicationContext
    Thread {
      val decision = try {
        ShieldChecks.checkCall(context, number)
      } catch (error: Exception) {
        Decision(null, "", "")
      }
      // Only High Concern numbers are silenced or blocked; "Caution" calls always ring.
      val action = if (decision.level == ScamApi.HIGH_CONCERN) settings.callAction else ShieldSettings.ACTION_WARN
      val response = CallResponse.Builder()
      if (action == ShieldSettings.ACTION_BLOCK) {
        response.setDisallowCall(true).setRejectCall(true).setSkipNotification(true)
      } else if (action == ShieldSettings.ACTION_SILENCE && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        response.setSilenceCall(true)
      }
      respondToCall(callDetails, response.build())

      if (decision.level != null) ShieldChecks.alert(context, "CALL", number, decision, action)
    }.start()
  }
}
