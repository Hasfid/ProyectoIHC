import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

export const themes = {
  light: {
    mode: 'light' as ThemeMode,
    background: '#f9fafb',
    surface: '#ffffff',
    card: '#ffffff',
    text: '#111827',
    subtext: '#374151',
    muted: '#6b7280',
    border: '#e5e7eb',
    primary: '#2e7d32',
    primaryText: '#ffffff',
    overlay: 'rgba(255,255,255,0.72)',
    inputBackground: '#f3f4f6',
    placeholder: '#9ca3af',
  },
  dark: {
    mode: 'dark' as ThemeMode,
    background: '#0d1520',
    surface: '#080e14',
    card: '#162333',
    text: '#f8fafc',
    subtext: '#94a3b8',
    muted: '#64748b',
    border: '#1e3347',
    primary: '#34d399',
    primaryText: '#0f1720',
    overlay: 'rgba(15, 23, 42, 0.72)',
    inputBackground: '#0b1120',
    placeholder: '#94a3af',
  },
};

const subscribers = new Set<(mode: ThemeMode) => void>();

export async function getStoredTheme(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  return 'light';
}

export async function setStoredTheme(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // ignore
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.body.style.backgroundColor = themes[mode].background;
    document.body.style.color = themes[mode].text;
  }

  subscribers.forEach((listener) => listener(mode));
}

export function subscribeThemeChanges(listener: (mode: ThemeMode) => void) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;
    getStoredTheme().then((stored) => {
      if (!mounted) return;
      setMode(stored);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        document.body.style.backgroundColor = themes[stored].background;
        document.body.style.color = themes[stored].text;
      }
    });

    const unsubscribe = subscribeThemeChanges((newMode) => {
      if (mounted) setMode(newMode);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const toggleTheme = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    await setStoredTheme(next);
    setMode(next);
  };

  return {
    mode,
    theme: themes[mode],
    toggleTheme,
    setTheme: setStoredTheme,
  };
}
