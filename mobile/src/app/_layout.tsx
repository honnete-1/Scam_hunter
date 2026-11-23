import { useEffect } from 'react';
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LockScreen from '../components/LockScreen';
import ProtectionBridge from '../components/ProtectionBridge';
import { AppLockProvider, useAppLock } from '../context/AppLockContext';
import { AuthProvider } from '../context/AuthContext';
import { CheckSessionProvider } from '../context/CheckSessionContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { fonts } from '../theme/typography';

// Keep the navy splash screen up only until the fonts are ready (no artificial delay).
SplashScreen.preventAutoHideAsync().catch(() => {});

function AppStack() {
  const { colors, isDark } = useTheme();
  const { locked } = useAppLock();
  const header = {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text,
    headerTitleStyle: { fontFamily: fonts.headingMedium },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.background },
  };

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={header}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ title: 'Check Result' }} />
        <Stack.Screen name="scan" options={{ title: 'Scan QR Code' }} />
        <Stack.Screen name="protection" options={{ title: 'Real-time Protection' }} />
        <Stack.Screen name="report" options={{ title: 'Report' }} />
        <Stack.Screen name="login" options={{ title: 'Log In' }} />
        <Stack.Screen name="signup" options={{ title: 'Sign Up' }} />
      </Stack>
      <ProtectionBridge />
      {locked ? <LockScreen /> : null}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
  });
  // If the fonts fail to load, carry on with the system font rather than blocking the app.
  const ready = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <CheckSessionProvider>
            <AppLockProvider>
              <AppStack />
            </AppLockProvider>
          </CheckSessionProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
