import React, { createContext, useContext } from 'react';
import { Platform } from 'react-native';
import { MD3DarkTheme } from 'react-native-paper';
import { DefaultTheme as NavigationDefaultTheme } from '@react-navigation/native';

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
    background: '#0f172a',
    surface: '#1e293b',
    surfaceVariant: '#334155',
    onSurface: '#f1f5f9',
    onSurfaceVariant: '#cbd5e1',
    onPrimary: '#f1f5f9'
  },
};

const navigationDarkTheme = {
  ...NavigationDefaultTheme,
  dark: true,
  fonts: navigationFonts,
  colors: {
    ...NavigationDefaultTheme.colors,
    primary: '#f1f5f9',
    background: '#0f172a',
    card: '#1e293b',
    text: '#f1f5f9',
    border: '#334155',
    notification: '#ef4444',
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Force dark-only theme across the app to match product requirement
  const isDarkMode = true;
  const setIsDarkMode = (_: boolean) => {
    // no-op: app is dark-only
    return;
  };

  const appTheme = darkTheme;
  const navigationTheme = navigationDarkTheme;

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
