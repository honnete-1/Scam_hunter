import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkState } from 'expo-network';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme/spacing';
import AppText from './AppText';

// Tells the user straight away when the phone is offline, before they try a check.
export default function OfflineBanner() {
  const { colors } = useTheme();
  const network = useNetworkState();
  // Only show it when we know for sure there is no connection.
  if (network.isConnected !== false && network.isInternetReachable !== false) return null;

  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: colors.status.unavailable.background, borderColor: colors.status.unavailable.border }]}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.text} />
      <AppText variant="small" style={styles.text}>You're offline. Checks need an internet connection.</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: spacing.lg },
  text: { flex: 1 },
});
