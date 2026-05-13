import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { en } from '../locales/en';
import { es } from '../locales/es';

export const LANGUAGE_CHANGED_EVENT = 'ecos_language_changed';

const translations: Record<string, any> = {
  en,
  es,
};

export const i18n = {
  locale: 'es',
  t(path: string) {
    const keys = path.split('.');
    let current: any = translations[this.locale] || translations['es'];
    for (const key of keys) {
      if (current === undefined || current[key] === undefined) {
        // Fallback a español
        let fallback: any = translations['es'];
        for (const k of keys) {
          if (fallback === undefined) break;
          fallback = fallback[k];
        }
        return fallback !== undefined ? fallback : path;
      }
      current = current[key];
    }
    return current;
  }
};

/**
 * Inicializa el idioma basado en AsyncStorage o la configuración del sistema.
 */
export const initI18n = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('app_language');
    if (savedLanguage) {
      i18n.locale = savedLanguage;
    } else {
      // Usar idioma del dispositivo
      const deviceLang = Localization.getLocales?.()?.[0]?.languageCode || 'es';
      i18n.locale = deviceLang;
    }
  } catch (error) {
    console.error('Error loading language', error);
    i18n.locale = Localization.getLocales?.()?.[0]?.languageCode || 'es';
  }
};

/**
 * Cambia el idioma de la aplicación.
 */
export const changeLanguage = async (lang: 'es' | 'en') => {
  try {
    i18n.locale = lang;
    await AsyncStorage.setItem('app_language', lang);
    DeviceEventEmitter.emit(LANGUAGE_CHANGED_EVENT, lang);
  } catch (error) {
    console.error('Error saving language', error);
  }
};
