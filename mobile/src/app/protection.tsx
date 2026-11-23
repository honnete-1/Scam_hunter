import { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AppText from '../components/AppText';
import { PrimaryButton, SecondaryButton, TextButton } from '../components/Buttons';
import Screen from '../components/Screen';
import StatusBadge from '../components/StatusBadge';
import { concernLabels } from '../content/labels';
import { useTheme } from '../context/ThemeContext';
import {
  clearAlerts, disableCallProtection, disableSmsProtection, enableCallProtection, enableSmsProtection, getAlerts,
  getStatus, openCallerIdSettings, openOverlaySettings, isProtectionAvailable, setCallAction, setPopupEnabled, setSkipContacts,
  showTestAlert, syncScamNumbers,
  type CallAction, type ProtectionAlert, type ProtectionStatus,
} from '../services/protection';
import { minTouch, radius, spacing } from '../theme/spacing';
import { timeAgo } from '../utils/time';

const CALL_ACTIONS: { value: CallAction; label: string }[] = [
  { value: 'warn', label: 'Warn me' },
  { value: 'silence', label: 'Silence' },
  { value: 'block', label: 'Block' },
];

function ToggleRow({ title, detail, value, onChange, disabled }: {
  title: string; detail: string; value: boolean; onChange: (next: boolean) => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="small" muted>{detail}</AppText>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
      />
    </View>
  );
}

function AlertItem({ alert }: { alert: ProtectionAlert }) {
  const { colors } = useTheme();
  const blocked = alert.kind === 'CALL' && alert.action === 'block';
  const level = concernLabels[alert.level];
  const isNumber = /^\+?\d{7,15}$/.test(alert.sender.replace(/[\s().-]/g, ''));
  return (
    <View style={[styles.alert, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.alertTop}>
        <Ionicons name={alert.kind === 'CALL' ? 'call-outline' : 'chatbubble-ellipses-outline'} size={18} color={colors.text} />
        <AppText variant="cardTitle" style={styles.flex}>
          {alert.kind === 'CALL' ? 'Call' : 'SMS'} from {alert.sender}
        </AppText>
        <AppText variant="small" muted>{timeAgo(alert.at)}</AppText>
      </View>
      <StatusBadge label={blocked ? 'Blocked' : level?.label ?? alert.level} tone={level?.tone ?? 'caution'} />
      {alert.reason ? <AppText>{alert.reason}</AppText> : null}
      {alert.saferAction ? <AppText variant="small" muted>{alert.saferAction}</AppText> : null}
      {isNumber ? (
        <TextButton
          label="Report this number"
          onPress={() => router.push({ pathname: '/report', params: { type: 'PHONE', content: alert.sender } })}
          style={styles.alertButton}
        />
      ) : null}
    </View>
  );
}

// Settings and history for the Android call and SMS protection (Truecaller-style warnings).
export default function ProtectionScreen() {
  const { colors } = useTheme();
  const [status, setStatus] = useState<ProtectionStatus | null>(() => getStatus());
  const [alerts, setAlerts] = useState<ProtectionAlert[]>(() => getAlerts());
  const [message, setMessage] = useState('');
  const [needsCallerIdSettings, setNeedsCallerIdSettings] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(() => {
    setStatus(getStatus());
    setAlerts(getAlerts());
  }, []);

  // Refresh when the screen opens and when the user comes back from Android's settings.
  useFocusEffect(refresh);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  if (!isProtectionAvailable() || !status) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <AppText variant="title" accessibilityRole="header">Real-time protection</AppText>
        <AppText muted style={styles.gap}>
          Warnings about scam calls and SMS while they arrive work in the installed Scam Hunter app for Android.
          They are not available in Expo Go, on iPhone or on the web.
        </AppText>
        <AppText muted style={styles.gap}>You can still check any message, link or number yourself.</AppText>
        <PrimaryButton label="Check Something" onPress={() => router.navigate('/check')} style={styles.gapLarge} />
      </Screen>
    );
  }

  async function toggleCalls(next: boolean) {
    setMessage('');
    setNeedsCallerIdSettings(false);
    if (!next) {
      disableCallProtection();
      setMessage('Call protection is off.');
    } else {
      const outcome = await enableCallProtection();
      if (outcome === 'on') setMessage('Call protection is on. Known scam numbers will be flagged before you answer.');
      else if (outcome === 'unsupported') setMessage('Checking calls needs Android 10 or newer.');
      else {
        setNeedsCallerIdSettings(true);
        setMessage('Scam Hunter was not chosen as the caller ID & spam app.');
      }
    }
    refresh();
  }

  async function toggleSms(next: boolean) {
    setMessage('');
    if (!next) {
      disableSmsProtection();
      setMessage('SMS protection is off.');
    } else {
      const outcome = await enableSmsProtection();
      if (outcome === 'on') setMessage('SMS protection is on. You will be warned when a new SMS shows warning signs.');
      else if (outcome === 'blocked') setMessage('SMS access is turned off for Scam Hunter. You can allow it in the app settings.');
      else setMessage('SMS protection was not turned on.');
    }
    refresh();
  }

  async function toggleContacts(next: boolean) {
    const outcome = await setSkipContacts(next);
    if (outcome === 'blocked') setMessage('Contacts access is turned off for Scam Hunter. You can allow it in the app settings.');
    refresh();
  }

  async function updateNumbers() {
    setSyncing(true);
    const ok = await syncScamNumbers();
    setSyncing(false);
    setMessage(ok ? 'The scam number list is up to date.' : 'Could not reach Scam Hunter. The saved list is still used.');
    refresh();
  }

  const anyOn = status.callsEnabled || status.smsEnabled;
  const callsOn = status.callsEnabled && status.callRoleHeld;

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <View style={styles.headerRow}>
        <AppText variant="title" accessibilityRole="header" style={styles.flex}>Real-time protection</AppText>
        <StatusBadge label={anyOn ? 'On' : 'Off'} tone={anyOn ? 'clear' : 'unavailable'} />
      </View>
      <AppText muted style={styles.gap}>
        Get a warning while a scam call rings or right after a scam SMS arrives, without copying anything.
      </AppText>

      {message ? (
        <AppText variant="small" style={[styles.message, { backgroundColor: colors.blueTint }]} accessibilityLiveRegion="polite">
          {message}
        </AppText>
      ) : null}
      {needsCallerIdSettings ? (
        <SecondaryButton label="Open Caller ID Settings" onPress={openCallerIdSettings} style={styles.gap} />
      ) : null}
      {anyOn && !status.notificationsAllowed ? (
        <View style={[styles.warning, { borderColor: colors.status.caution.border, backgroundColor: colors.status.caution.background }]}>
          <AppText variant="small" color={colors.status.caution.text}>
            Notifications are off for Scam Hunter, so warnings cannot be shown.
          </AppText>
          <TextButton label="Open Settings" onPress={() => Linking.openSettings()} />
        </View>
      ) : null}

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>Calls</AppText>
        <ToggleRow
          title="Check incoming calls"
          detail={status.callScreeningSupported
            ? 'Only the caller\'s number is checked. Calls from your contacts are not checked.'
            : 'Needs Android 10 or newer.'}
          value={callsOn}
          onChange={toggleCalls}
          disabled={!status.callScreeningSupported}
        />
        <AppText variant="small" muted style={styles.gap}>When a confirmed scam number calls</AppText>
        <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          {CALL_ACTIONS.map((option) => {
            const selected = option.value === status.callAction;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={selected}
                aria-disabled={!callsOn}
                disabled={!callsOn}
                onPress={() => {
                  setCallAction(option.value);
                  refresh();
                }}
                style={[styles.option, selected && { backgroundColor: colors.surface }]}
              >
                <AppText variant="cardTitle" color={selected ? colors.link : colors.textMuted}>{option.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="small" muted>
          Only numbers confirmed by a moderator are silenced or blocked. Other suspicious calls still ring, with a warning.
        </AppText>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>SMS</AppText>
        <ToggleRow
          title="Check incoming SMS"
          detail="Each new SMS is checked by the Scam Hunter server and then forgotten. Your inbox is never read."
          value={status.smsEnabled && status.smsPermission}
          onChange={toggleSms}
        />
        <ToggleRow
          title="Skip messages from my contacts"
          detail="Messages from people saved in your contacts are not sent for checking."
          value={status.skipContacts && status.contactsPermission}
          onChange={toggleContacts}
          disabled={!status.smsEnabled}
        />
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>Pop-up warning</AppText>
        <ToggleRow
          title="Show warning on top of the call screen"
          detail="A warning card appears over the incoming call, or over any app when a scam SMS arrives."
          value={status.popupEnabled && status.overlayAllowed}
          onChange={(next) => {
            setPopupEnabled(next);
            refresh();
          }}
        />
        {status.popupEnabled && !status.overlayAllowed ? (
          <View style={[styles.warning, { borderColor: colors.status.caution.border, backgroundColor: colors.status.caution.background }]}>
            <AppText variant="small" color={colors.status.caution.text}>
              Android needs your permission first: turn on &ldquo;Display over other apps&rdquo; for Scam Hunter, then come back.
            </AppText>
            <TextButton label="Open Settings" onPress={openOverlaySettings} />
          </View>
        ) : null}
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>Known scam numbers</AppText>
        <AppText>
          {status.scamNumberCount === 1 ? '1 number' : `${status.scamNumberCount} numbers`} confirmed by moderators,
          saved on this phone so they are recognised instantly, even offline.
        </AppText>
        <AppText variant="small" muted>
          {status.numbersSyncedAt ? `Updated ${timeAgo(status.numbersSyncedAt)}` : 'Not downloaded yet'}
        </AppText>
        <SecondaryButton label="Update Now" loading={syncing} loadingLabel="Updating" onPress={updateNumbers} style={styles.gap} />
        <TextButton label="Send a test warning" onPress={showTestAlert} />
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <View style={styles.headerRow}>
          <AppText variant="label" muted style={styles.flex}>Recent warnings</AppText>
          {alerts.length ? (
            <TextButton
              label="Clear"
              onPress={() => {
                clearAlerts();
                refresh();
              }}
            />
          ) : null}
        </View>
        {alerts.length ? (
          alerts.map((alert) => <AlertItem key={`${alert.at}-${alert.sender}`} alert={alert} />)
        ) : (
          <AppText muted>No warnings yet. Warnings are kept on this phone only, without the message text.</AppText>
        )}
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>WhatsApp and other apps</AppText>
        <AppText>
          Got a suspicious message somewhere else? Long-press it, tap Share, then choose Scam Hunter to check it.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  gap: { marginTop: spacing.sm },
  gapLarge: { marginTop: spacing.xl },
  message: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.sm },
  warning: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, gap: spacing.xs },
  section: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: minTouch },
  flex: { flex: 1, gap: 2 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  option: { flex: 1, minHeight: minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  alert: { borderWidth: 1, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm },
  alertTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  alertButton: { alignSelf: 'flex-start' },
});
