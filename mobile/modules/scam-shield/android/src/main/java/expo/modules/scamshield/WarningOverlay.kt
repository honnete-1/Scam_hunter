package expo.modules.scamshield

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

// A warning card drawn on top of the incoming-call screen (or any open app when a scam SMS arrives),
// like caller-ID apps do. It needs the "Display over other apps" permission from Android settings.
object WarningOverlay {
  private const val AUTO_HIDE_MS = 45_000L
  private val NAVY = 0xFF111144.toInt()
  private val HIGH_RED = 0xFFE53935.toInt()
  private val CAUTION_AMBER = 0xFFFFB300.toInt()
  private const val APP_SCHEME = "scamhunter"

  private val mainHandler = Handler(Looper.getMainLooper())
  private var current: View? = null

  fun canShow(context: Context): Boolean = Settings.canDrawOverlays(context)

  fun show(context: Context, high: Boolean, title: String, subtitle: String, reason: String, saferAction: String, reportNumber: String?) {
    if (!canShow(context)) return
    val appContext = context.applicationContext
    // Windows can only be added from the main thread.
    mainHandler.post {
      try {
        showNow(appContext, high, title, subtitle, reason, saferAction, reportNumber)
      } catch (error: Exception) {
        // The permission was removed or the window could not be added; the notification is still shown.
      }
    }
  }

  private fun showNow(context: Context, high: Boolean, title: String, subtitle: String, reason: String, saferAction: String, reportNumber: String?) {
    hideNow(context)
    val accent = if (high) HIGH_RED else CAUTION_AMBER

    val card = LinearLayout(context)
    card.orientation = LinearLayout.VERTICAL
    card.setPadding(dp(context, 18), dp(context, 16), dp(context, 18), dp(context, 12))
    card.background = GradientDrawable().apply {
      setColor(NAVY)
      cornerRadius = dp(context, 20).toFloat()
      setStroke(dp(context, 2), accent)
    }
    card.elevation = dp(context, 12).toFloat()

    val header = LinearLayout(context)
    header.orientation = LinearLayout.HORIZONTAL
    header.gravity = Gravity.CENTER_VERTICAL
    val icon = ImageView(context)
    icon.setImageResource(R.drawable.scam_shield_notification)
    icon.setColorFilter(accent)
    header.addView(icon, LinearLayout.LayoutParams(dp(context, 22), dp(context, 22)))
    header.addView(text(context, "SCAM HUNTER", 12f, accent, bold = true), LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
      leftMargin = dp(context, 8)
    })
    card.addView(header)

    card.addView(text(context, title, 19f, Color.WHITE, bold = true), spaced(context, 10))
    card.addView(text(context, subtitle, 14f, 0xFFC5CAE9.toInt()), spaced(context, 2))
    if (reason.isNotBlank()) card.addView(text(context, reason, 15f, Color.WHITE), spaced(context, 10))
    if (saferAction.isNotBlank()) card.addView(text(context, saferAction, 14f, 0xFFFFE0B2.toInt()), spaced(context, 8))

    val buttons = LinearLayout(context)
    buttons.orientation = LinearLayout.HORIZONTAL
    buttons.gravity = Gravity.END
    if (reportNumber != null) {
      val report = button(context, "Report number", accent)
      report.setOnClickListener {
        hideNow(context)
        val link = "$APP_SCHEME://report?type=PHONE&content=" + Uri.encode(reportNumber)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).setPackage(context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
        } catch (error: Exception) {
          // The app could not be opened from here; the notification also has this button.
        }
      }
      buttons.addView(report)
    }
    val dismiss = button(context, "Dismiss", Color.WHITE)
    dismiss.setOnClickListener { hideNow(context) }
    buttons.addView(dismiss)
    card.addView(buttons, spaced(context, 8))

    // Side margins around the card; the frame itself lets touches outside pass to the call screen.
    val frame = FrameLayout(context)
    frame.setPadding(dp(context, 12), 0, dp(context, 12), 0)
    frame.addView(card)

    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      WindowManager.LayoutParams.TYPE_PHONE
    }
    val params = WindowManager.LayoutParams(
      ViewGroup.LayoutParams.MATCH_PARENT,
      ViewGroup.LayoutParams.WRAP_CONTENT,
      type,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
      PixelFormat.TRANSLUCENT
    )
    // At the top, so the answer and decline buttons at the bottom stay free.
    params.gravity = Gravity.TOP
    params.y = dp(context, 40)

    val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    windowManager.addView(frame, params)
    current = frame
    mainHandler.postDelayed({ if (current === frame) hideNow(context) }, AUTO_HIDE_MS)
  }

  fun hide(context: Context) {
    mainHandler.post { hideNow(context.applicationContext) }
  }

  private fun hideNow(context: Context) {
    val view = current ?: return
    current = null
    try {
      (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(view)
    } catch (error: Exception) {
      // Already removed.
    }
  }

  private fun text(context: Context, value: String, size: Float, color: Int, bold: Boolean = false): TextView {
    val view = TextView(context)
    view.text = value
    view.setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
    view.setTextColor(color)
    if (bold) view.setTypeface(view.typeface, Typeface.BOLD)
    return view
  }

  private fun button(context: Context, label: String, color: Int): TextView {
    val view = text(context, label, 15f, color, bold = true)
    view.setPadding(dp(context, 14), dp(context, 12), dp(context, 14), dp(context, 12))
    view.isClickable = true
    view.isFocusable = false
    return view
  }

  private fun spaced(context: Context, topDp: Int): LinearLayout.LayoutParams {
    val params = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
    params.topMargin = dp(context, topDp)
    return params
  }

  private fun dp(context: Context, value: Int): Int =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), context.resources.displayMetrics).toInt()
}
