import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';
import AppText from '../../components/AppText';
import { SecondaryButton } from '../../components/Buttons';
import CheckForm from '../../components/CheckForm';
import Screen from '../../components/Screen';
import { useCheckSession } from '../../context/CheckSessionContext';
import { spacing } from '../../theme/spacing';
import type { CheckType } from '../../types/api';

const TYPES: CheckType[] = ['MESSAGE', 'URL', 'PHONE'];

export default function CheckScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const initialType = TYPES.includes(params.type as CheckType) ? (params.type as CheckType) : 'MESSAGE';
  const { setLastCheck } = useCheckSession();

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>Check something suspicious</AppText>
      <SecondaryButton label="Scan a QR Code" onPress={() => router.push('/scan')} style={styles.scan} />
      {/* key: coming from Home with a different type starts the form on that type. */}
      <CheckForm
        key={initialType}
        initialType={initialType}
        onResult={(type, content, result) => {
          // Kept in memory only, for the result screen and an optional report.
          setLastCheck({ type, content, result });
          router.push('/result');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: spacing.lg },
  scan: { marginBottom: spacing.xl },
});
