import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import AppText from '../components/AppText';
import { PrimaryButton, TextButton } from '../components/Buttons';
import ErrorBanner from '../components/ErrorBanner';
import Screen from '../components/Screen';
import { failureLabel, type FailureType } from '../content/labels';
import { useCheckSession } from '../context/CheckSessionContext';
import { useTheme } from '../context/ThemeContext';
import { checkContent } from '../services/api';
import { tapFeedback } from '../services/feedback';
import { radius, spacing } from '../theme/spacing';
import { classifyScannedCode } from '../utils/scan';

// Scans a QR code (on a poster, payment sticker or message) and checks what it contains.
// Fake QR codes that lead to phishing sites are a growing scam ("quishing").
export default function ScanScreen() {
  const { colors } = useTheme();
  const { setLastCheck } = useCheckSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<FailureType | null>(null);
  // The camera reports the same code many times a second; only the first one counts.
  const handled = useRef(false);

  async function onScanned({ data }: { data: string }) {
    if (handled.current || !data) return;
    handled.current = true;
    tapFeedback();
    setChecking(true);
    setFailure(null);

    const { type, content } = classifyScannedCode(data);
    const outcome = await checkContent(type, content);
    setChecking(false);

    if (outcome.kind === 'result') {
      setLastCheck({ type, content, result: outcome.result });
      router.replace('/result');
    } else if (outcome.kind === 'fieldError') {
      // Not something we can check (e.g. an empty or unusual code): let the user try another.
      setFailure('server');
      handled.current = false;
    } else {
      setFailure(outcome.kind);
      handled.current = false;
    }
  }

  if (!permission) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <ActivityIndicator color={colors.text} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen edges={['left', 'right', 'bottom']}>
        <AppText variant="title" accessibilityRole="header">Scan a QR code</AppText>
        <AppText muted style={styles.gap}>
          Scam Hunter needs the camera to read QR codes. Nothing is recorded, and only the code's content is checked.
        </AppText>
        {permission.canAskAgain ? (
          <PrimaryButton label="Allow Camera" onPress={requestPermission} style={styles.button} />
        ) : (
          <>
            <AppText muted style={styles.gap}>Camera access is turned off. You can turn it on in your phone's settings.</AppText>
            <PrimaryButton label="Open Settings" onPress={() => Linking.openSettings()} style={styles.button} />
          </>
        )}
        <TextButton label="Back" onPress={() => router.back()} />
      </Screen>
    );
  }

  const failureText = failureLabel(failure);

  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <AppText muted style={styles.hint}>Point the camera at a QR code. It is checked automatically.</AppText>
      <View style={[styles.frame, { borderColor: colors.cta }]}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={checking ? undefined : onScanned}
          accessibilityLabel="Camera view for scanning a QR code"
        />
        {checking ? (
          <View style={[styles.overlay, { backgroundColor: colors.background }]}>
            <ActivityIndicator color={colors.text} />
            <AppText variant="bodyStrong">Checking...</AppText>
          </View>
        ) : null}
      </View>
      {failure ? <ErrorBanner title={failureText.title} detail={failureText.detail} note="Point the camera at the code to try again." /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { marginTop: spacing.md },
  button: { marginTop: spacing.xl, marginBottom: spacing.sm },
  hint: { marginBottom: spacing.lg },
  frame: { aspectRatio: 1, borderRadius: radius.lg, borderWidth: 3, overflow: 'hidden' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, opacity: 0.9, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
