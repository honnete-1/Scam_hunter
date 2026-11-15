import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fonts } from '../../theme/typography';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName, focusedName: IconName) {
  return ({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) => (
    <Ionicons name={focused ? focusedName : name} color={color as string} size={size} />
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.link,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="check" options={{ title: 'Check', tabBarIcon: icon('scan-outline', 'scan') }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('document-text-outline', 'document-text') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('person-circle-outline', 'person-circle') }} />
    </Tabs>
  );
}
