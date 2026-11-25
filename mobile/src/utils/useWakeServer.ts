import { useEffect } from 'react';
import { AppState } from 'react-native';
import { wakeServer } from '../services/api';

// Wakes the server when the app opens, and again when the user comes back to it,
// since the server may have fallen asleep while the app was in the background.
export function useWakeServer() {
  useEffect(() => {
    void wakeServer();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void wakeServer();
    });
    return () => subscription.remove();
  }, []);
}
