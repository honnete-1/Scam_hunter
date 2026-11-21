import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppLock } from '../context/AppLockContext';
import { brand } from '../theme/colors';
import { spacing } from '../theme/spacing';
import AppText from './AppText';
import { PrimaryButton } from './Buttons';

// Covers the whole app while it is locked. The unlock prompt opens straight away.
export default function LockScreen() {
  const { unlock } = useAppLock();

  useEffect(() => {
    unlock();
  }, []);

  return (
    <SafeAreaView style={styles.screen} accessibilityViewIsModal>
      <View style={styles.center}>
        <View style={styles.badge}>
          <Ionicons name="lock-closed" size={36} color={brand.lusterWhite} />
        </View>
        <AppText variant="title" color={brand.lusterWhite} accessibilityRole="header">Scam Hunter is locked</AppText>
        <AppText color="#B6BDD7" style={styles.text}>Use your fingerprint, face or phone PIN to continue.</AppText>
      </View>
      <PrimaryButton label="Unlock" onPress={unlock} style={styles.button} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: brand.deadlyDepths, padding: spacing.screen, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  badge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#2C2C63', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  text: { textAlign: 'center' },
  button: { marginBottom: spacing.xl },
});
