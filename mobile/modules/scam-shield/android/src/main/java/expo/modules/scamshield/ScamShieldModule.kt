package expo.modules.scamshield

import android.Manifest
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val ROLE_REQUEST_CODE = 4711

// The bridge between the React Native screens and the Android call/SMS protection.
class ScamShieldModule : Module() {
  private var rolePromise: Promise? = null

  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ScamShield")

    Events("onSharedText")

    Function("getStatus") {
      val settings = ShieldSettings(context)
      mapOf(
        "callScreeningSupported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q),
        "callRoleHeld" to hasCallRole(),
        "callsEnabled" to settings.callsEnabled,
        "callAction" to settings.callAction,
        "smsEnabled" to settings.smsEnabled,
        "smsPermission" to isGranted(Manifest.permission.RECEIVE_SMS),
        "skipContacts" to settings.skipContacts,
        "contactsPermission" to isGranted(Manifest.permission.READ_CONTACTS),
        "notificationsAllowed" to ShieldNotifications.canNotify(context),
        "popupEnabled" to settings.popupEnabled,
        "overlayAllowed" to WarningOverlay.canShow(context),
        "scamNumberCount" to settings.scamNumberCount,
        "numbersSyncedAt" to settings.numbersSyncedAt.toDouble(),
        "lastCallCheckedAt" to settings.lastCallCheckedAt.toDouble()
      )
    }

    Function("configure") { apiUrl: String ->
      ShieldSettings(context).apiUrl = apiUrl
    }

    Function("setCallsEnabled") { enabled: Boolean ->
      ShieldSettings(context).callsEnabled = enabled
    }

    Function("setSmsEnabled") { enabled: Boolean ->
      ShieldSettings(context).smsEnabled = enabled
    }

    Function("setPopupEnabled") { enabled: Boolean ->
      ShieldSettings(context).popupEnabled = enabled
    }

    // Android only lets the user grant "Display over other apps" on this settings page.
    Function("openOverlaySettings") {
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:" + context.packageName))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("setSkipContacts") { enabled: Boolean ->
      ShieldSettings(context).skipContacts = enabled
    }

    Function("setCallAction") { action: String ->
      val allowed = listOf(ShieldSettings.ACTION_WARN, ShieldSettings.ACTION_SILENCE, ShieldSettings.ACTION_BLOCK)
      val settings = ShieldSettings(context)
      settings.callAction = if (action in allowed) action else settings.callAction
    }

    Function("setScamNumbers") { numbers: List<String>, reports: List<Int> ->
      ShieldSettings(context).saveScamNumbers(numbers, reports)
    }

    // Returned as a JSON string; the screen parses it.
    Function("getHistory") {
      ShieldSettings(context).history().toString()
    }

    Function("clearHistory") {
      ShieldSettings(context).clearHistory()
    }

    Function("showTestAlert") {
      val text = "This is a test. A real warning looks like this when a suspicious call or SMS arrives."
      ShieldNotifications.show(context, "Scam Hunter protection is on", text, null)
      if (ShieldSettings(context).popupEnabled) {
        WarningOverlay.show(context, true, "Test: possible scam call", "Incoming call from +250 7XX XXX XXX", text, "Tap Dismiss to close this card.", null)
      }
      null
    }

    // Text shared to Scam Hunter from another app (e.g. a WhatsApp message). Read once, then cleared.
    Function("takeSharedText") {
      val activity = appContext.currentActivity
      val text = sharedText(activity?.intent)
      if (text != null) activity?.intent?.removeExtra(Intent.EXTRA_TEXT)
      text
    }

    // Opens Android's own dialog: "Set Scam Hunter as your caller ID & spam app?"
    AsyncFunction("requestCallScreeningRole") { promise: Promise ->
      val activity = appContext.currentActivity
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || activity == null) {
        promise.resolve(false)
      } else if (hasCallRole()) {
        promise.resolve(true)
      } else {
        val roleManager = context.getSystemService(RoleManager::class.java)
        rolePromise = promise
        activity.startActivityForResult(roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), ROLE_REQUEST_CODE)
      }
    }.runOnQueue(Queues.MAIN)

    // If the dialog was refused before, Android may not show it again; the user can pick the app here.
    Function("openDefaultAppsSettings") {
      val intent = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode == ROLE_REQUEST_CODE) {
        rolePromise?.resolve(hasCallRole())
        rolePromise = null
      }
    }

    OnNewIntent { intent ->
      val text = sharedText(intent)
      if (text != null) sendEvent("onSharedText", mapOf("text" to text))
    }
  }

  private fun hasCallRole(): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return false
    val roleManager = context.getSystemService(RoleManager::class.java) ?: return false
    return roleManager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) &&
      roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)
  }

  private fun isGranted(permission: String): Boolean =
    ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED

  private fun sharedText(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("text/") != true) return null
    return intent.getStringExtra(Intent.EXTRA_TEXT)?.takeIf { it.isNotBlank() }
  }
}
