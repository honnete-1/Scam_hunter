import { PermissionsAndroid } from 'react-native';
import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';
import ProtectionScreen from '../src/app/protection';
import { ThemeProvider } from '../src/context/ThemeContext';
import { timeAgo } from '../src/utils/time';
import { mockFetch } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    router: { push: jest.fn(), navigate: jest.fn() },
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});

// A fake of the Android native module, so the screen can be tested without a phone.
const mockShield: Record<string, any> = {
  status: {
    callScreeningSupported: true,
    callRoleHeld: false,
    callsEnabled: false,
    callAction: 'warn',
    smsEnabled: false,
    smsPermission: false,
    skipContacts: true,
    contactsPermission: false,
    notificationsAllowed: true,
    scamNumberCount: 0,
    numbersSyncedAt: 0,
  },
  history: '[]',
  getStatus: jest.fn((): object => ({ ...mockShield.status })),
  getHistory: jest.fn((): string => mockShield.history),
  configure: jest.fn(),
  setCallsEnabled: jest.fn(),
  setSmsEnabled: jest.fn((enabled: boolean) => {
    mockShield.status.smsEnabled = enabled;
    mockShield.status.smsPermission = true;
  }),
  setSkipContacts: jest.fn(),
  setCallAction: jest.fn(),
  setScamNumbers: jest.fn(),
  clearHistory: jest.fn(),
  showTestAlert: jest.fn(),
  takeSharedText: jest.fn(() => null),
  requestCallScreeningRole: jest.fn(async () => false),
  openDefaultAppsSettings: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};
let mockNativeAvailable = true;
jest.mock('expo', () => ({
  ...jest.requireActual('expo'),
  requireOptionalNativeModule: () => (mockNativeAvailable ? mockShield : null),
}));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));

function loadScreen() {
  return render(<ThemeProvider><ProtectionScreen /></ThemeProvider>);
}

const SCAM_NUMBERS = {
  generated_at: '2026-11-22T10:00:00Z',
  count: 1,
  numbers: [{ phone_number: '+250788444999', reports: 3 }],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNativeAvailable = true;
  mockShield.status.smsEnabled = false;
  mockShield.status.smsPermission = false;
  mockShield.history = '[]';
});

describe('Real-time protection', () => {
  test('explains that it needs the Android app when the native part is missing', async () => {
    mockNativeAvailable = false;
    await loadScreen();
    expect(screen.getByText(/work in the installed Scam Hunter app for Android/)).toBeTruthy();
  });

  test('turning on SMS checks asks for permission and downloads the scam number list', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    mockFetch({ status: 200, body: SCAM_NUMBERS });
    await loadScreen();

    await fireEvent(screen.getByLabelText('Check incoming SMS'), 'valueChange', true);

    expect(PermissionsAndroid.request).toHaveBeenCalledWith(PermissionsAndroid.PERMISSIONS.RECEIVE_SMS, expect.anything());
    expect(mockShield.setSmsEnabled).toHaveBeenCalledWith(true);
    expect(mockShield.setScamNumbers).toHaveBeenCalledWith(['+250788444999'], [3]);
    expect(await screen.findByText(/SMS protection is on/)).toBeTruthy();
  });

  test('SMS checks stay off when the permission is refused', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
    await loadScreen();

    await fireEvent(screen.getByLabelText('Check incoming SMS'), 'valueChange', true);

    expect(mockShield.setSmsEnabled).not.toHaveBeenCalled();
    expect(await screen.findByText('SMS protection was not turned on.')).toBeTruthy();
  });

  test('offers the caller ID settings when Scam Hunter was not chosen for calls', async () => {
    jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    const user = userEvent.setup();
    await loadScreen();

    await fireEvent(screen.getByLabelText('Check incoming calls'), 'valueChange', true);

    expect(mockShield.requestCallScreeningRole).toHaveBeenCalled();
    expect(mockShield.setCallsEnabled).not.toHaveBeenCalled();
    await user.press(await screen.findByText('Open Caller ID Settings'));
    expect(mockShield.openDefaultAppsSettings).toHaveBeenCalled();
  });

  test('lists saved warnings without any message text', async () => {
    mockShield.history = JSON.stringify([{
      kind: 'SMS',
      sender: '+250788444999',
      level: 'HIGH_CONCERN',
      reason: 'Reported as a scam by 3 people and confirmed by a moderator.',
      saferAction: "Don't reply, open links or send money.",
      action: 'warn',
      at: Date.now(),
    }]);
    await loadScreen();

    expect(screen.getByText('SMS from +250788444999')).toBeTruthy();
    expect(screen.getByText('High Concern')).toBeTruthy();
    expect(screen.getByText('Report this number')).toBeTruthy();
  });

  test('shows when warnings cannot appear because notifications are off', async () => {
    mockShield.status.smsEnabled = true;
    mockShield.status.notificationsAllowed = false;
    await loadScreen();
    expect(screen.getByText(/Notifications are off for Scam Hunter/)).toBeTruthy();
    mockShield.status.notificationsAllowed = true;
  });
});

describe('timeAgo', () => {
  test('writes short relative times', () => {
    const now = Date.UTC(2026, 10, 22, 12, 0);
    expect(timeAgo(now - 20_000, now)).toBe('just now');
    expect(timeAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
  });
});
