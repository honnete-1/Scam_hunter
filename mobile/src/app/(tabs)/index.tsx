import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AppText from '../../components/AppText';
import { PrimaryButton, TextButton } from '../../components/Buttons';
import CheckTypeSelector from '../../components/CheckTypeSelector';
import MessageVisual from '../../components/MessageVisual';
import Screen from '../../components/Screen';
import { SAFETY_TIPS } from '../../content/labels';
import { useTheme } from '../../context/ThemeContext';
import { minTouch, spacing } from '../../theme/spacing';
import type { CheckType } from '../../types/api';

function greeting(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const { colors } = useTheme();
  const [type, setType] = useState<CheckType>('MESSAGE');
  // A different tip each day, chosen from a short fixed list.
  const tip = SAFETY_TIPS[new Date().getDate() % SAFETY_TIPS.length];

  return (
    <Screen>
      <View style={styles.topBar}>
        <AppText variant="label" color={colors.link}>Scam Hunter</AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profile"
          onPress={() => router.navigate('/profile')}
          hitSlop={8}
          style={[styles.avatar, { borderColor: colors.border }]}
        >
          <Ionicons name="person-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <AppText muted style={styles.greeting}>{greeting(new Date().getHours())}</AppText>
      <AppText variant="hero" accessibilityRole="header" maxFontSizeMultiplier={1.4}>
        Check before you act<AppText variant="hero" color={colors.cta}>.</AppText>
      </AppText>

      <View style={styles.visual}>
        <MessageVisual />
      </View>

      <AppText variant="section" style={styles.question}>What do you want to check?</AppText>
      <CheckTypeSelector value={type} onChange={setType} compact />
      <PrimaryButton
        label="Check Now"
        onPress={() => router.navigate({ pathname: '/check', params: { type } })}
        style={styles.cta}
      />
      <TextButton label="Scan a QR code instead" onPress={() => router.push('/scan')} style={styles.scan} />

      <View style={[styles.tip, { borderTopColor: colors.border }]}>
        <AppText variant="label" muted>Safety tip</AppText>
        <AppText>{tip}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  avatar: { width: minTouch - 6, height: minTouch - 6, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  greeting: { marginBottom: spacing.xs },
  visual: { marginTop: spacing.xl, marginBottom: spacing.xl },
  question: { marginBottom: spacing.md },
  cta: { marginTop: spacing.lg },
  scan: { alignSelf: 'center' },
  tip: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs },
});
