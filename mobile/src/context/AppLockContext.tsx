import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { getItem, setItem } from '../services/storage';

// Optional app lock with fingerprint, face or the phone's PIN, so someone holding your
// phone can't open your reports or account.

const LOCK_KEY = 'scamHunterAppLock';
// Lock again only after the app was away this long, so quick switches (and the
// fingerprint prompt itself) don't lock it in a loop.
const RELOCK_AFTER_MS = 30000;

type AppLockValue = {
  available: boolean;
  enabled: boolean;
  locked: boolean;
  unlock: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<'ok' | 'not_available' | 'cancelled'>;
};

const AppLockContext = createContext<AppLockValue | null>(null);

async function authenticate(promptMessage: string) {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
    return result.success;
  } catch {
    return false;
  }
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [locked, setLocked] = useState(false);
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const ready = (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
        setAvailable(ready);
        const saved = (await getItem(LOCK_KEY)) === 'on';
        setEnabledState(saved && ready);
        setLocked(saved && ready);
      } catch {
        setAvailable(false);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') leftAt.current = Date.now();
      if (state === 'active' && leftAt.current !== null) {
        if (enabled && Date.now() - leftAt.current > RELOCK_AFTER_MS) setLocked(true);
        leftAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [enabled]);

  async function unlock() {
    const success = await authenticate('Unlock Scam Hunter');
    if (success) setLocked(false);
    return success;
  }

  async function setEnabled(next: boolean) {
    if (next && !available) return 'not_available';
    // Turning it on or off needs a successful check, so nobody else can change it.
    if (!(await authenticate(next ? 'Turn on App lock' : 'Turn off App lock'))) return 'cancelled';
    setEnabledState(next);
    await setItem(LOCK_KEY, next ? 'on' : 'off');
    return 'ok';
  }

  return (
    <AppLockContext.Provider value={{ available, enabled, locked, unlock, setEnabled }}>{children}</AppLockContext.Provider>
  );
}

export function useAppLock() {
  const value = useContext(AppLockContext);
  if (!value) throw new Error('useAppLock must be used inside AppLockProvider');
  return value;
}
