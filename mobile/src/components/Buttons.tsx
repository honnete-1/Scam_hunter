import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { minTouch, radius, spacing } from '../theme/spacing';
import AppText from './AppText';

type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

// Orange is kept for the main action on a screen, like "Check Message" or "Submit Report".
export function PrimaryButton({ label, onPress, disabled, loading, loadingLabel, style, accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={inactive}
      aria-busy={loading}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: pressed ? colors.ctaPressed : colors.cta, opacity: disabled && !loading ? 0.55 : 1 },
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.onCta} />
          <AppText variant="button" color={colors.onCta}>{loadingLabel ?? label}</AppText>
        </View>
      ) : (
        <AppText variant="button" color={colors.onCta}>{label}</AppText>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled, loading, loadingLabel, style, accessibilityHint }: ButtonProps) {
  const { colors } = useTheme();
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={inactive}
      aria-busy={loading}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { borderWidth: 1.5, borderColor: pressed ? colors.primary : colors.borderStrong, backgroundColor: pressed ? colors.blueTint : 'transparent' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.text} /> : <AppText variant="button">{label}</AppText>}
    </Pressable>
  );
}

export function TextButton({ label, onPress, style }: Pick<ButtonProps, 'label' | 'onPress' | 'style'>) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.text, { opacity: pressed ? 0.6 : 1 }, style]}
    >
      <AppText variant="button" color={colors.link}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  text: { minHeight: minTouch, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
});
