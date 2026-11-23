import { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import AppText from '../../components/AppText';
import { PrimaryButton, SecondaryButton } from '../../components/Buttons';
import Screen from '../../components/Screen';
import { API_URL } from '../../config';
import { useAppLock } from '../../context/AppLockContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { minTouch, radius, spacing } from '../../theme/spacing';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();
  const { user, logout } = useAuth();
  const appLock = useAppLock();
  const [lockMessage, setLockMessage] = useState('');

  async function toggleAppLock(next: boolean) {
    const outcome = await appLock.setEnabled(next);
    if (outcome === 'not_available') setLockMessage('Set up a fingerprint, face or screen lock on your phone first.');
    else if (outcome === 'cancelled') setLockMessage('App lock was not changed.');
    else setLockMessage(next ? 'App lock is on.' : 'App lock is off.');
  }

  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">Profile</AppText>

      <View style={[styles.section, { borderColor: colors.border }]}>
        {user ? (
          <>
            <AppText variant="label" muted>Signed in as</AppText>
            <AppText variant="section">{user.username}</AppText>
            {user.email ? <AppText muted>{user.email}</AppText> : null}
            <SecondaryButton label="Log Out" onPress={logout} style={styles.button} />
          </>
        ) : (
          <>
            <AppText muted>Log in to submit community reports and follow their review.</AppText>
            <PrimaryButton label="Log In" onPress={() => router.push('/login')} style={styles.button} />
            <SecondaryButton label="Create Account" onPress={() => router.push('/signup')} />
          </>
        )}
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>Theme</AppText>
        <View accessibilityRole="radiogroup" style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          {THEME_OPTIONS.map((option) => {
            const selected = option.value === preference;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                aria-checked={selected}
                onPress={() => setPreference(option.value)}
                style={[styles.option, selected && { backgroundColor: colors.surface }]}
              >
                <AppText variant="cardTitle" color={selected ? colors.link : colors.textMuted}>{option.label}</AppText>
              </Pressable>
            );
          })}
        </View>
        <AppText variant="small" muted>System follows your phone's light or dark setting.</AppText>
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>Security</AppText>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">App lock</AppText>
            <AppText variant="small" muted>
              {appLock.available
                ? 'Ask for your fingerprint, face or phone PIN when opening Scam Hunter.'
                : 'Needs a fingerprint, face or screen lock set up on this device.'}
            </AppText>
          </View>
          <Switch
            accessibilityLabel="App lock"
            value={appLock.enabled}
            onValueChange={toggleAppLock}
            disabled={!appLock.available}
            trackColor={{ true: colors.primary, false: colors.borderStrong }}
          />
        </View>
        {lockMessage ? <AppText variant="small" muted accessibilityLiveRegion="polite">{lockMessage}</AppText> : null}
        <SecondaryButton label="Real-time Protection" onPress={() => router.push('/protection')} style={styles.button} />
        <SecondaryButton label="My Number Was Reported by Mistake" onPress={() => router.push('/removal-request')} style={styles.button} />
      </View>

      <View style={[styles.section, { borderColor: colors.border }]}>
        <AppText variant="label" muted>About Scam Hunter</AppText>
        <AppText>
          Scam Hunter looks for warning signs in messages, links and phone numbers. It cannot prove whether
          something is a scam, so always verify unexpected requests yourself.
        </AppText>
        <AppText variant="small" muted>Server: {API_URL}</AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  button: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  flex: { flex: 1, gap: 2 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.md, gap: 4, marginVertical: spacing.xs },
  option: { flex: 1, minHeight: minTouch, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
});
