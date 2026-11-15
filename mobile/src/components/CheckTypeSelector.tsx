import { Pressable, StyleSheet, View } from 'react-native';
import { checkTypeLabels } from '../content/labels';
import { useTheme } from '../context/ThemeContext';
import { minTouch, radius, spacing } from '../theme/spacing';
import type { CheckType } from '../types/api';
import AppText from './AppText';

const TYPES: CheckType[] = ['MESSAGE', 'URL', 'PHONE'];

type Props = {
  value: CheckType;
  onChange: (type: CheckType) => void;
  disabled?: boolean;
  // Home uses "Number"; everywhere else "Phone". Both fit small screens, and screen readers still say "Phone Number".
  compact?: boolean;
};

// A segmented control instead of three big cards: one row, one choice.
export default function CheckTypeSelector({ value, onChange, disabled, compact }: Props) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      {TYPES.map((type) => {
        const selected = type === value;
        const label = type === 'PHONE' ? (compact ? 'Number' : 'Phone') : checkTypeLabels[type];
        return (
          <Pressable
            key={type}
            accessibilityRole="tab"
            accessibilityLabel={checkTypeLabels[type]}
            aria-selected={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onPress={() => onChange(type)}
            style={[styles.option, selected && { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <AppText variant="cardTitle" color={selected ? colors.link : colors.textMuted} style={styles.text} numberOfLines={1}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4 },
  option: {
    flex: 1,
    minHeight: minTouch,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  text: { fontSize: 15 },
});
