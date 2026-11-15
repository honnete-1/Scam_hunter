import { Pressable, Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import * as storage from '../src/services/storage';
import { darkPalette, lightPalette } from '../src/theme/colors';

jest.mock('../src/services/storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => {}),
  deleteItem: jest.fn(async () => {}),
}));

const mockScheme = jest.fn();
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockScheme(),
}));

function Probe() {
  const { colors, isDark, setPreference } = useTheme();
  return (
    <>
      <Text>{isDark ? 'dark' : 'light'}</Text>
      <Text>{colors.background}</Text>
      <Pressable accessibilityRole="button" onPress={() => setPreference('light')}>
        <Text>Use light</Text>
      </Pressable>
    </>
  );
}

test('follows the phone when it prefers dark', async () => {
  mockScheme.mockReturnValue('dark');
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText('dark')).toBeOnTheScreen();
  expect(screen.getByText(darkPalette.background)).toBeOnTheScreen();
});

test('falls back to light when the phone gives no preference', async () => {
  mockScheme.mockReturnValue(null);
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(screen.getByText('light')).toBeOnTheScreen();
  expect(screen.getByText(lightPalette.background)).toBeOnTheScreen();
});

test('a manual choice overrides the system and is remembered', async () => {
  mockScheme.mockReturnValue('dark');
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  await userEvent.setup().press(screen.getByRole('button', { name: 'Use light' }));
  expect(screen.getByText('light')).toBeOnTheScreen();
  expect(storage.setItem).toHaveBeenCalledWith('scamHunterTheme', 'light');
});

test('a saved choice is used on the next start', async () => {
  mockScheme.mockReturnValue('light');
  (storage.getItem as jest.Mock).mockResolvedValueOnce('dark');
  await render(<ThemeProvider><Probe /></ThemeProvider>);
  expect(await screen.findByText('dark')).toBeOnTheScreen();
});
