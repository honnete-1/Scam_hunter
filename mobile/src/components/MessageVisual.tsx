import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';

// Home screen picture of what the app does: a suspicious text with the risky parts marked.
// The result shown is what the real backend returns for this message (Caution, 2 signs).
export default function MessageVisual() {
  const { colors, isDark } = useTheme();
  const caution = colors.status.caution;
  const mark = { backgroundColor: caution.background, color: colors.text };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Example: a text saying your account will be blocked and asking for your PIN is marked Caution with 2 warning signs."
      style={[styles.wrap, { backgroundColor: isDark ? colors.surface : colors.blueTint }]}
    >
      <View style={styles.senderRow}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.textMuted} />
        </View>
        <AppText variant="small" muted>Unknown sender · Example</AppText>
      </View>

      <View style={[styles.bubble, { backgroundColor: isDark ? colors.surfaceAlt : colors.surface }]}>
        <AppText>
          Your account will be blocked today. <AppText style={mark}>Send your PIN immediately</AppText>.
        </AppText>
      </View>

      <View style={[styles.result, { backgroundColor: colors.background, borderColor: caution.border }]}>
        <Ionicons name="shield-half-outline" size={18} color={caution.text} />
        <AppText variant="label" color={caution.text}>Caution</AppText>
        <AppText variant="small" muted>2 warning signs</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: radius.lg, borderTopLeftRadius: 4, padding: spacing.lg },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
});
