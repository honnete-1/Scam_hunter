import { Share, Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as LocalAuthentication from 'expo-local-authentication';
import CheckForm from '../src/components/CheckForm';
import OfflineBanner from '../src/components/OfflineBanner';
import { shareWarning } from '../src/components/ResultView';
import { AppLockProvider, useAppLock } from '../src/context/AppLockContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { classifyScannedCode } from '../src/utils/scan';
import { AppProviders } from '../test-utils/helpers';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));
jest.mock('expo-clipboard', () => ({ getStringAsync: jest.fn() }));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
const mockNetworkState = jest.fn();
jest.mock('expo-network', () => ({ useNetworkState: () => mockNetworkState() }));

describe('QR code scanning', () => {
  test('sorts scanned codes into the right check', () => {
    expect(classifyScannedCode('https://bk-login.example/verify')).toEqual({ type: 'URL', content: 'https://bk-login.example/verify' });
    expect(classifyScannedCode('pay-now.xyz/claim')).toEqual({ type: 'URL', content: 'pay-now.xyz/claim' });
    expect(classifyScannedCode('tel:+250788123456')).toEqual({ type: 'PHONE', content: '+250788123456' });
    expect(classifyScannedCode('0788 123 456')).toEqual({ type: 'PHONE', content: '0788 123 456' });
    expect(classifyScannedCode('SMSTO:0788123456:Send your PIN now')).toEqual({ type: 'MESSAGE', content: 'Send your PIN now' });
    expect(classifyScannedCode('You won a prize, call us')).toEqual({ type: 'MESSAGE', content: 'You won a prize, call us' });
  });
});

describe('Paste from clipboard', () => {
  test('fills the input only when the user taps Paste', async () => {
    const user = userEvent.setup();
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('  Reply with your OTP now  ');
    await render(<CheckForm onResult={jest.fn()} />, { wrapper: AppProviders });

    expect(Clipboard.getStringAsync).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(screen.getByLabelText('Message to check')).toHaveDisplayValue('Reply with your OTP now');
  });

  test('explains when the clipboard is empty', async () => {
    const user = userEvent.setup();
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('');
    await render(<CheckForm onResult={jest.fn()} />, { wrapper: AppProviders });
    await user.press(screen.getByRole('button', { name: 'Paste from clipboard' }));
    expect(screen.getByText(/nothing to paste/)).toBeOnTheScreen();
  });
});

describe('Share warning', () => {
  test('shares the verdict and safer action, but not the checked content', async () => {
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    await shareWarning('High Concern', 'This content contains several concerning signs.', 'Do not send money.', 'message');
    const { message } = spy.mock.calls[0][0] as { message: string };
    expect(message).toContain('High Concern');
    expect(message).toContain('Do not send money.');
    expect(message).toContain('Check before you act.');
  });
});

describe('Offline banner', () => {
  test('appears only when the phone is known to be offline', async () => {
    mockNetworkState.mockReturnValue({ isConnected: false });
    await render(<ThemeProvider><OfflineBanner /></ThemeProvider>);
    expect(screen.getByText("You're offline. Checks need an internet connection.")).toBeOnTheScreen();
  });

  test('is hidden while online or still unknown', async () => {
    mockNetworkState.mockReturnValue({});
    await render(<ThemeProvider><OfflineBanner /></ThemeProvider>);
    expect(screen.queryByText(/You're offline/)).not.toBeOnTheScreen();
  });
});

function LockProbe({ onReady }: { onReady: (lock: ReturnType<typeof useAppLock>) => void }) {
  const lock = useAppLock();
  onReady(lock);
  return <Text>{lock.enabled ? 'lock on' : 'lock off'}</Text>;
}

describe('App lock', () => {
  test('turning it on needs a successful fingerprint/face check', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    let lock: ReturnType<typeof useAppLock> | null = null;
    await render(<AppLockProvider><LockProbe onReady={(value) => (lock = value)} /></AppLockProvider>);
    await screen.findByText('lock off');

    expect(await lock!.setEnabled(true)).toBe('cancelled');
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: true });
    expect(await lock!.setEnabled(true)).toBe('ok');
    expect(await screen.findByText('lock on')).toBeOnTheScreen();
  });

  test('cannot be turned on when the phone has no biometrics or screen lock', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValue(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValue(false);
    let lock: ReturnType<typeof useAppLock> | null = null;
    await render(<AppLockProvider><LockProbe onReady={(value) => (lock = value)} /></AppLockProvider>);
    await screen.findByText('lock off');
    expect(await lock!.setEnabled(true)).toBe('not_available');
  });
});
