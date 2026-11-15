import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';
import { TextButton } from './Buttons';

type Props = { title: string; detail?: string; onRetry?: () => void; note?: string };

// Used when the app could not reach the backend, or the backend failed in an unexpected way.
// It is deliberately not the "Check could not be completed" result, which comes from the backend.
export default function ErrorBanner({ title, detail, onRetry, note }: Props) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.box, { backgroundColor: colors.status.unavailable.background, borderColor: colors.status.unavailable.border }]}
    >
      <AppText variant="bodyStrong">{title}</AppText>
      {detail ? <AppText muted>{detail}</AppText> : null}
      {note ? <AppText variant="small" muted style={styles.note}>{note}</AppText> : null}
      {onRetry ? <TextButton label="Try again" onPress={onRetry} style={styles.retry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.md, padding: spacing.lg, gap: spacing.xs, marginTop: spacing.lg },
  note: { marginTop: spacing.xs },
  retry: { alignSelf: 'flex-start', paddingHorizontal: 0, minHeight: 40 },
});
