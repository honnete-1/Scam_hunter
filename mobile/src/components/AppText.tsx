import { Text, type TextProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { textVariants, type TextVariant } from '../theme/typography';

type Props = TextProps & { variant?: TextVariant; muted?: boolean; color?: string };

// Text that always uses the Scam Hunter fonts and theme colours.
export default function AppText({ variant = 'body', muted, color, style, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[textVariants[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]}
    />
  );
}
