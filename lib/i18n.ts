import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { en } from '../locales/en';
import { es } from '../locales/es';

/** Event emitted when the user changes the application language. */
export const LANGUAGE_CHANGED_EVENT = 'ecos_language_changed';

const translations: Record<string, any> = {
  en,
  es,
};

/**
 * Internationalization engine for the platform.
 * Supports fallback to Spanish if a key is not found in the target language.
 */
export const i18n = {
  locale: 'es',
  t(path: string) {
    const keys = path.split('.');
    let current: any = translations[this.locale] || translations['es'];
    for (const key of keys) {
      if (current === undefined || current[key] === undefined) {
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
 * Initializes the internationalization state based on persistent storage or system defaults.
 * @returns {Promise<void>}
 */
export const initI18n = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem('app_language');
    if (savedLanguage) {
      i18n.locale = savedLanguage;
    } else {
      const deviceLang = Localization.getLocales?.()?.[0]?.languageCode || 'es';
      i18n.locale = deviceLang;
    }
  } catch (error) {
    console.error('Error loading language', error);
    i18n.locale = Localization.getLocales?.()?.[0]?.languageCode || 'es';
  }
};

/**
 * Changes the active language of the application and persists the choice.
 * Emits an event to notify listeners of the change.
 * @param {'es' | 'en'} lang The target language code.
 * @returns {Promise<void>}
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
