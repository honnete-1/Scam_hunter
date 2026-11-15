import { StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import type { StatusTone } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';

// The result is always written out, so colour is never the only signal.
export default function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const { colors } = useTheme();
  const status = colors.status[tone];
  return (
    <View style={[styles.badge, { backgroundColor: status.background, borderColor: status.border }]}>
      <View style={[styles.dot, { backgroundColor: status.text }]} />
      <AppText variant="label" color={status.text}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
