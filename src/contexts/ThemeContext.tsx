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
    primary: '#8b5cf6',
    primaryContainer: '#312e81',
    onPrimaryContainer: '#f3e8ff',
    secondary: '#38bdf8',
    secondaryContainer: '#172554',
    onSecondaryContainer: '#e0f2fe',
    tertiary: '#fb7185',
    tertiaryContainer: '#4c1d95',
    onTertiaryContainer: '#ffe4f1',
    surface: '#0f1526',
    surfaceVariant: '#182033',
    background: '#060816',
    onSurface: '#f8fafc',
    onSurfaceVariant: '#cbd5e1',
    onPrimary: '#06201d',
    onSecondary: '#f8fafc',
    onTertiary: '#f8fafc',
    outline: '#334155',
    outlineVariant: '#273449',
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
    cardVisaBg: '#4256c8',
    cardVisaAccent: '#2f41a4',
    cardMastercardBg: '#FF6B6B',
    cardMastercardAccent: '#FF8E8E',
    cardAmexBg: '#C026D3',
    cardAmexAccent: '#D946EF',
    cardRupayBg: '#7C3AED',
    cardRupayAccent: '#A78BFA',
    cardDefaultBg: '#0076e6',
    cardDefaultAccent: '#0593e6',
    cardText: '#ffffff',
    rewardMilesBg: '#2a0f44',
    rewardCashbackBg: '#0f2d28',
    rewardMilesText: '#f3d8ff',
    rewardCashbackText: '#d9fff6',
    rewardMilesAccent: '#d8b4fe',
    rewardCashbackAccent: '#6ee7d8',
  },
};

const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    // Primary brand
    primary: '#6d28d9',
    primaryContainer: '#f3e8ff',
    onPrimaryContainer: '#1e1b4b',
    onPrimary: '#FFFFFF',
    // Support
    secondary: '#0F172A',
    secondaryContainer: '#E6F4FF',
    tertiary: '#FF6EA5',
    tertiaryContainer: '#FFF0F7',
    // Surfaces
    surface: '#FFFFFF',
    surfaceVariant: '#FBF8FF',
    background: '#F3F1FF',
    onSurface: '#07102A',
    onSurfaceVariant: '#1F2937',
    onSecondary: '#ffffff',
    outline: '#d4d4e8',
    outlineVariant: '#ebe7f8',
    error: '#b91c1c',
    errorContainer: '#fee2e2',
    onError: '#ffffff',
    onErrorContainer: '#5B1220',
    success: '#16a34a',
    successContainer: '#dcfce7',
    onSuccessContainer: '#064E3B',
    warning: '#b45309',
    warningContainer: '#fff7ed',
    onWarningContainer: '#7A4100',
    info: '#2563eb',
    infoContainer: '#dbeafe',
    onInfoContainer: '#1e3a8a',
    shadow: 'rgba(16, 24, 40, 0.06)',
    scrim: 'rgba(0, 0, 0, 0.04)',
    categoryFood: '#FF6B6B',
    categoryTravel: '#4ECDC4',
    categoryShopping: '#FFE66D',
    categoryUtilities: '#95E1D3',
    categoryEntertainment: '#C7CEEA',
    categoryDefault: '#64748b',
    // Card gradients and accents sampled from mockup
    cardVisaBg: '#0000c6',
    cardVisaAccent: '#0e0da1',
    cardMastercardBg: '#1b1a1f',
    cardMastercardAccent: '#181818',
    cardAmexBg: '#06B6D4',
    cardAmexAccent: '#0E7490',
    cardRupayBg: '#662409',
    cardRupayAccent: '#2f1f09',
    cardDefaultBg: '#67032F',
    cardDefaultAccent: '#4C0121',
    cardText: '#ffffff',
    // Reward tiles
    rewardMilesBg: '#FBF6FF',
    rewardCashbackBg: '#F0FFFB',
    rewardMilesText: '#4B227A',
    rewardCashbackText: '#0E6B5E',
    rewardMilesAccent: '#9146FF',
    rewardCashbackAccent: '#10B981',
  },
};

const navigationDarkTheme = {
  ...NavigationDarkTheme,
  dark: true,
  fonts: navigationFonts,
  colors: {
    ...NavigationDarkTheme.colors,
    primary: '#8b5cf6',
    background: '#060816',
    card: '#0f1526',
    text: '#f8fafc',
    border: '#182033',
    notification: '#f59e0b',
  },
};

const navigationLightTheme = {
  ...NavigationDefaultTheme,
  dark: false,
  fonts: navigationFonts,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#6d28d9',
    background: '#f7f4ff',
    card: '#ffffff',
    text: '#0f172a',
    border: '#ebe7f8',
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
