import { Platform } from 'react-native';

// Set EXPO_PUBLIC_API_URL in .env.local (see .env.example). The fallback only helps local development:
// the Android emulator reaches this computer at 10.0.2.2, the iOS simulator and web at localhost.
const fallbackUrl = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || fallbackUrl).replace(/\/+$/, '');

// Give up on a request after this long, so a dead connection doesn't leave the user waiting forever.
// 60 s because Render's free server sleeps when idle and takes about a minute to wake up.
export const REQUEST_TIMEOUT_MS = 60000;
