import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Only the login token and the theme choice are ever stored. Checked content never is.
// On a phone this is the device's secure storage. Secure storage doesn't exist in a browser,
// so the web preview falls back to localStorage (development only).

export async function getItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // If storage fails the value just lasts for this session.
  }
}

export async function deleteItem(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to delete.
  }
}
