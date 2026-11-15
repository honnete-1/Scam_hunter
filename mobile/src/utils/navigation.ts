import { router } from 'expo-router';

// After logging in or signing up. next=back means "return to the screen that sent you here",
// e.g. the report form, which still has its draft in memory.
export function finishAuth(next?: string) {
  if (next === 'back' && router.canGoBack()) router.back();
  else router.replace('/');
}
