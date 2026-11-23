import { useEffect } from 'react';
import { router } from 'expo-router';
import { useCheckSession } from '../context/CheckSessionContext';
import { checkContent } from '../services/api';
import { onSharedText, startProtection, takeSharedText } from '../services/protection';
import { classifyScannedCode } from '../utils/scan';

// Runs once at app start: prepares call/SMS protection and handles text shared from other apps
// (Share > Scam Hunter on a WhatsApp message, email or browser link). Renders nothing.
export default function ProtectionBridge() {
  const { setLastCheck } = useCheckSession();

  useEffect(() => {
    async function checkShared(text: string) {
      const { type, content } = classifyScannedCode(text);
      const outcome = await checkContent(type, content);
      if (outcome.kind === 'result') {
        setLastCheck({ type, content, result: outcome.result });
        router.push('/result');
      } else {
        // Offline or not checkable right now: open the form with the text so the user can try again.
        router.push({ pathname: '/check', params: { type, content } });
      }
    }

    startProtection().catch(() => {});
    const shared = takeSharedText();
    if (shared) checkShared(shared);
    const stop = onSharedText(checkShared);
    return () => stop?.();
  }, [setLastCheck]);

  return null;
}
