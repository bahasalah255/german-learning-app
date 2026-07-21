/**
 * ThemeContext — global dark/light mode provider.
 *
 * Usage:
 *   const { theme, isDark, themeMode, setThemeMode } = useTheme();
 *
 * themeMode: 'light' | 'dark' | 'system'
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme } from './theme';

const THEME_KEY = 'appThemeMode';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState('light'); // default until loaded

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setThemeModeState(saved);
      }
    });
  }, []);

  const setThemeMode = useCallback(async (mode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem(THEME_KEY, mode);
  }, []);

  // Resolve actual theme object based on mode + system
  const theme = useMemo(() => {
    if (themeMode === 'system') {
      return systemScheme === 'dark' ? darkTheme : lightTheme;
    }
    return themeMode === 'dark' ? darkTheme : lightTheme;
  }, [themeMode, systemScheme]);

  const isDark = theme.dark;

  const value = useMemo(
    () => ({ theme, isDark, themeMode, setThemeMode }),
    [theme, isDark, themeMode, setThemeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
