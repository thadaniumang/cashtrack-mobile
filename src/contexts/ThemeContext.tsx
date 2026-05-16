import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme, DarkTheme as NavigationDarkTheme } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ThemeContextType {
  isDarkMode: boolean;
  setIsDarkMode: (isDark: boolean) => void;
  appTheme: any;
  navigationTheme: any;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const navigationFonts = Platform.select({
  web: {
    regular: {
      fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      fontWeight: '600',
    },
    heavy: {
      fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
      fontWeight: '700',
    },
  },
  ios: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '600',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '700',
    },
  },
  default: {
    regular: {
      fontFamily: 'sans-serif',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'sans-serif-medium',
      fontWeight: 'normal',
    },
    bold: {
      fontFamily: 'sans-serif',
      fontWeight: '600',
    },
    heavy: {
      fontFamily: 'sans-serif',
      fontWeight: '700',
    },
  },
});

const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#2dd4bf',
    primaryContainer: '#134e4a',
    onPrimaryContainer: '#d9fffb',
    secondary: '#f8fafc',
    secondaryContainer: '#1e293b',
    onSecondaryContainer: '#e2e8f0',
    tertiary: '#a855f7',
    tertiaryContainer: '#4c1d95',
    onTertiaryContainer: '#f3e8ff',
    surface: '#111827',
    surfaceVariant: '#1f2937',
    background: '#0b1220',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#cbd5e1',
    onPrimary: '#06201d',
    onSecondary: '#f8fafc',
    onTertiary: '#f8fafc',
    outline: '#334155',
    outlineVariant: '#475569',
    error: '#ef4444',
    errorContainer: '#7f1d1d',
    onError: '#ffffff',
    onErrorContainer: '#fee2e2',
    success: '#22c55e',
    successContainer: '#14532d',
    onSuccessContainer: '#dcfce7',
    warning: '#f59e0b',
    warningContainer: '#FFF4E5',
    onWarningContainer: '#7A4100',
    info: '#2196f3',
    infoContainer: '#1d4ed8',
    onInfoContainer: '#dbeafe',
    shadow: 'rgba(15, 23, 42, 0.35)',
    scrim: 'rgba(0, 0, 0, 0.5)',
    categoryFood: '#FF6B6B',
    categoryTravel: '#4ECDC4',
    categoryShopping: '#FFE66D',
    categoryUtilities: '#95E1D3',
    categoryEntertainment: '#C7CEEA',
    categoryDefault: '#B0BEC5',
    cardVisaBg: '#1a1f71',
    cardVisaAccent: '#1434CB',
    cardMastercardBg: '#eb001b',
    cardMastercardAccent: '#ff5f00',
    cardAmexBg: '#006fcf',
    cardAmexAccent: '#00a8e1',
    cardRupayBg: '#ff6b6b',
    cardRupayAccent: '#ff8c8c',
    cardDefaultBg: '#333333',
    cardDefaultAccent: '#666666',
    rewardMilesBg: '#430d4f',
    rewardCashbackBg: '#0f6315',
    rewardMilesText: '#e5c6f7',
    rewardCashbackText: '#cafacd',
    rewardMilesAccent: '#efbcf7',
    rewardCashbackAccent: '#b9fabc',
  },
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#0f766e',
    primaryContainer: '#bbf7f0',
    onPrimary: '#ffffff',
    secondary: '#0f172a',
    secondaryContainer: '#e6eef7',
    tertiary: '#7c3aed',
    tertiaryContainer: '#efe6ff',
    surface: '#ffffff',
    surfaceVariant: '#f3f4f6',
    background: '#f8fafc',
    onSurface: '#0f172a',
    onSurfaceVariant: '#475569',
    onSecondary: '#ffffff',
    outline: '#cbd5e1',
    outlineVariant: '#e2e8f0',
    error: '#b91c1c',
    errorContainer: '#fee2e2',
    onError: '#ffffff',
    onErrorContainer: '#7f1d1d',
    success: '#16a34a',
    successContainer: '#dcfce7',
    onSuccessContainer: '#14532d',
    warning: '#b45309',
    warningContainer: '#fff7ed',
    onWarningContainer: '#7A4100',
    info: '#2563eb',
    infoContainer: '#dbeafe',
    onInfoContainer: '#1e3a8a',
    shadow: 'rgba(15, 23, 42, 0.08)',
    scrim: 'rgba(0, 0, 0, 0.08)',
    categoryFood: '#FF6B6B',
    categoryTravel: '#4ECDC4',
    categoryShopping: '#FFE66D',
    categoryUtilities: '#95E1D3',
    categoryEntertainment: '#C7CEEA',
    categoryDefault: '#64748b',
    cardVisaBg: '#e8eefc',
    cardVisaAccent: '#1434CB',
    cardMastercardBg: '#ffe9ea',
    cardMastercardAccent: '#ff5f00',
    cardAmexBg: '#e6f2ff',
    cardAmexAccent: '#00a8e1',
    cardRupayBg: '#ffecec',
    cardRupayAccent: '#ff8c8c',
    cardDefaultBg: '#f1f5f9',
    cardDefaultAccent: '#94a3b8',
    rewardMilesBg: '#f7eefb',
    rewardCashbackBg: '#ecfdf5',
    rewardMilesText: '#5b21b6',
    rewardCashbackText: '#065f46',
    rewardMilesAccent: '#7c3aed',
    rewardCashbackAccent: '#059669',
  },
};

const navigationDarkTheme = {
  ...NavigationDarkTheme,
  dark: true,
  fonts: navigationFonts,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: '#2dd4bf',
    background: '#0b1220',
    card: '#111827',
    text: '#f8fafc',
    border: '#1f2937',
    notification: '#f59e0b',
  },
};

const navigationLightTheme = {
  ...NavigationDefaultTheme,
  dark: false,
  fonts: navigationFonts,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#0f766e',
    background: '#f8fafc',
    card: '#ffffff',
    text: '#0f172a',
    border: '#e6eef7',
    notification: '#b45309',
  },
};

const THEME_STORAGE_KEY = 'cashtrack-theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isThemeReady, setIsThemeReady] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!isCancelled && savedMode) {
          setIsDarkMode(savedMode === 'dark');
        }
      } catch (error) {
        console.warn('Failed to load theme preference', error);
      } finally {
        if (!isCancelled) {
          setIsThemeReady(true);
        }
      }
    };

    void loadThemePreference();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isThemeReady) {
      return;
    }

    AsyncStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? 'dark' : 'light').catch((error) => {
      console.warn('Failed to save theme preference', error);
    });
  }, [isDarkMode, isThemeReady]);

  const appTheme = isDarkMode ? darkTheme : lightTheme;
  const navigationTheme = isDarkMode ? navigationDarkTheme : navigationLightTheme;

  return (
    <ThemeContext.Provider value={{ isDarkMode, setIsDarkMode, appTheme, navigationTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
