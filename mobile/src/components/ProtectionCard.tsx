import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useTheme } from '../context/ThemeContext';
import { getAlerts, getStatus, isProtectionAvailable } from '../services/protection';
import { radius, spacing } from '../theme/spacing';
import AppText from './AppText';

// Home screen shortcut to real-time protection, with its current state.
export default function ProtectionCard() {
  const { colors } = useTheme();
  const [summary, setSummary] = useState({ on: false, warnings: 0 });

  useFocusEffect(
    useCallback(() => {
      const status = getStatus();
      setSummary({ on: Boolean(status && (status.callsEnabled || status.smsEnabled)), warnings: getAlerts().length });
    }, []),
  );

  let detail = 'Get warned about scam calls and SMS as they arrive.';
  if (!isProtectionAvailable()) detail = 'Available in the Scam Hunter Android app.';
  else if (summary.on) detail = summary.warnings === 1 ? '1 warning so far' : `${summary.warnings} warnings so far`;

  const tone = summary.on ? colors.status.clear : colors.status.unavailable;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Real-time protection, ${summary.on ? 'on' : 'off'}. ${detail}`}
      onPress={() => router.push('/protection')}
      style={({ pressed }) => [styles.card, { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: tone.background, borderColor: tone.border }]}>
        <Ionicons name={summary.on ? 'shield-checkmark' : 'shield-outline'} size={22} color={tone.text} />
      </View>
      <View style={styles.text}>
        <AppText variant="cardTitle">Real-time protection: {summary.on ? 'On' : 'Off'}</AppText>
        <AppText variant="small" muted>{detail}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderRadius: radius.md },
  icon: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
