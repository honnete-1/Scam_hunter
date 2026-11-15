import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/typography';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';

type Props = TextInputProps & {
  label: string;
  // Hide the label visually when the screen title already says what to type.
  hideLabel?: boolean;
  hint?: string;
  error?: string;
  optional?: boolean;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

// A labelled input with its hint and error shown right below it.
export default function FormField({ label, hideLabel, hint, error, optional, multiline, style, ref, ...inputProps }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      {!hideLabel && (
        <AppText variant="bodyStrong" style={styles.label}>
          {label}
          {optional ? <AppText muted> (optional)</AppText> : null}
        </AppText>
      )}
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={[
          styles.input,
          multiline && styles.multiline,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.status.high.text : colors.borderStrong,
          },
          style,
        ]}
        {...inputProps}
      />
      {hint && !error ? <AppText variant="small" muted style={styles.below}>{hint}</AppText> : null}
      {error ? (
        <AppText variant="small" color={colors.status.high.text} style={styles.below} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: spacing.lg },
  label: { marginBottom: spacing.sm, fontSize: 15 },
  input: {
    minHeight: 54,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  multiline: { minHeight: 150, paddingTop: spacing.md },
  below: { marginTop: spacing.sm },
});
