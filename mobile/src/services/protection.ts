// Real-time protection: checks incoming calls and SMS on Android (see modules/scam-shield).
// The native part only exists in the installed Android app, not in Expo Go, on iOS or on the web.
import { Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';
import { requireOptionalNativeModule, type EventSubscription } from 'expo';
import { API_URL } from '../config';
import { getScamNumbers } from './api';

export type CallAction = 'warn' | 'silence' | 'block';

export type ProtectionStatus = {
  callScreeningSupported: boolean;
  callRoleHeld: boolean;
  callsEnabled: boolean;
  callAction: CallAction;
  smsEnabled: boolean;
  smsPermission: boolean;
  skipContacts: boolean;
  contactsPermission: boolean;
  notificationsAllowed: boolean;
  popupEnabled: boolean;
  // "Display over other apps", needed for the warning card on top of the call screen.
  overlayAllowed: boolean;
  scamNumberCount: number;
  numbersSyncedAt: number;
};

// One saved warning. The message text itself is never saved, only who sent it and why it was flagged.
export type ProtectionAlert = {
  kind: 'CALL' | 'SMS';
  sender: string;
  level: 'HIGH_CONCERN' | 'CAUTION';
  reason: string;
  saferAction: string;
  action: CallAction;
  at: number;
};

type ScamShieldModule = {
  getStatus(): ProtectionStatus;
  configure(apiUrl: string): void;
  setCallsEnabled(enabled: boolean): void;
  setSmsEnabled(enabled: boolean): void;
  setSkipContacts(enabled: boolean): void;
  setPopupEnabled(enabled: boolean): void;
  openOverlaySettings(): void;
  setCallAction(action: CallAction): void;
  setScamNumbers(numbers: string[], reports: number[]): void;
  getHistory(): string;
  clearHistory(): void;
  showTestAlert(): void;
  takeSharedText(): string | null;
  requestCallScreeningRole(): Promise<boolean>;
  openDefaultAppsSettings(): void;
  addListener(event: 'onSharedText', listener: (event: { text: string }) => void): EventSubscription;
};

// The module is Android-only, so this is null on iOS, on the web and in Expo Go.
function native() {
  return requireOptionalNativeModule<ScamShieldModule>('ScamShield');
}

export function isProtectionAvailable() {
  return native() !== null;
}

export function getStatus(): ProtectionStatus | null {
  const shield = native();
  return shield ? shield.getStatus() : null;
}

// Called when the app starts: tells the native side where the backend is and refreshes the number list.
export async function startProtection() {
  const shield = native();
  if (!shield) return;
  shield.configure(API_URL);
  const status = shield.getStatus();
  if (status.callsEnabled || status.smsEnabled) await syncScamNumbers();
}

// Downloads the approved scam numbers so calls and SMS from them are flagged instantly, even offline.
export async function syncScamNumbers(): Promise<boolean> {
  const shield = native();
  if (!shield) return false;
  const res = await getScamNumbers();
  if (!res.ok) return false;
  shield.setScamNumbers(
    res.data.numbers.map((entry) => entry.phone_number),
    res.data.numbers.map((entry) => entry.reports),
  );
  return true;
}

type PermissionOutcome = 'granted' | 'denied' | 'blocked';

async function askPermission(permission: Permission, title: string, message: string): Promise<PermissionOutcome> {
  const result = await PermissionsAndroid.request(permission, { title, message, buttonPositive: 'Allow', buttonNegative: 'Not now' });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  return result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ? 'blocked' : 'denied';
}

// Android 13+ asks before an app may show notifications; warnings are useless without them.
async function askForNotifications() {
  if (Number(Platform.Version) < 33) return 'granted';
  return askPermission(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    'Allow scam warnings',
    'Scam Hunter shows a warning notification when a suspicious call or SMS arrives.',
  );
}

export type EnableOutcome = 'on' | 'denied' | 'blocked' | 'unsupported';

export async function enableCallProtection(): Promise<EnableOutcome> {
  const shield = native();
  if (!shield) return 'unsupported';
  if (!shield.getStatus().callScreeningSupported) return 'unsupported';
  await askForNotifications();
  const roleHeld = await shield.requestCallScreeningRole();
  if (!roleHeld) return 'blocked';
  shield.setCallsEnabled(true);
  await syncScamNumbers();
  return 'on';
}

export async function enableSmsProtection(): Promise<EnableOutcome> {
  const shield = native();
  if (!shield) return 'unsupported';
  const sms = await askPermission(
    PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    'Check new SMS for scams',
    'Scam Hunter checks each new SMS for warning signs. It cannot read your inbox, and messages are never stored.',
  );
  if (sms !== 'granted') return sms;
  await askForNotifications();
  shield.setSmsEnabled(true);
  await syncScamNumbers();
  return 'on';
}

export function disableCallProtection() {
  const shield = native();
  shield?.setCallsEnabled(false);
}

export function disableSmsProtection() {
  const shield = native();
  shield?.setSmsEnabled(false);
}

// Skipping contacts needs permission to look numbers up in the contacts list (nothing is uploaded).
export async function setSkipContacts(enabled: boolean): Promise<PermissionOutcome> {
  const shield = native();
  if (!shield) return 'denied';
  if (enabled) {
    const outcome = await askPermission(
      PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
      'Skip messages from your contacts',
      'Scam Hunter only looks up whether a sender is saved in your contacts. Your contacts are never uploaded.',
    );
    if (outcome !== 'granted') return outcome;
  }
  shield.setSkipContacts(enabled);
  return 'granted';
}

// The pop-up card needs "Display over other apps", which Android only grants on its own settings page.
export function setPopupEnabled(enabled: boolean) {
  const shield = native();
  shield?.setPopupEnabled(enabled);
  if (enabled && shield && !shield.getStatus().overlayAllowed) shield.openOverlaySettings();
}

export function openOverlaySettings() {
  native()?.openOverlaySettings();
}

export function setCallAction(action: CallAction) {
  const shield = native();
  shield?.setCallAction(action);
}

export function getAlerts(): ProtectionAlert[] {
  const shield = native();
  if (!shield) return [];
  try {
    const alerts = JSON.parse(shield.getHistory());
    return Array.isArray(alerts) ? alerts : [];
  } catch {
    return [];
  }
}

export function clearAlerts() {
  const shield = native();
  shield?.clearHistory();
}

export function showTestAlert() {
  const shield = native();
  shield?.showTestAlert();
}

// Where the user can pick Scam Hunter as the caller ID & spam app if the dialog was refused before.
export function openCallerIdSettings() {
  const shield = native();
  if (shield) shield.openDefaultAppsSettings();
  else Linking.openSettings();
}

// Text shared to Scam Hunter from another app (e.g. a WhatsApp message) with Android's Share menu.
export function takeSharedText(): string | null {
  const shield = native();
  return shield ? shield.takeSharedText() : null;
}

export function onSharedText(listener: (text: string) => void): (() => void) | null {
  const shield = native();
  if (!shield) return null;
  const subscription = shield.addListener('onSharedText', (event) => listener(event.text));
  return () => subscription.remove();
}
