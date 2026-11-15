import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from '../theme/colors';
import { getItem, setItem } from '../services/storage';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeValue = {
  colors: Palette;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const THEME_KEY = 'scamHunterTheme';
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
    });
  }, []);

  function setPreference(next: ThemePreference) {
    setPreferenceState(next);
    setItem(THEME_KEY, next);
  }

  // Follow the phone's setting unless the user picked one. Unknown system setting means light.
  const resolved = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const isDark = resolved === 'dark';

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkPalette : lightPalette, isDark, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider');
  return value;
}
