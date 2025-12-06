import { useScenarioStore } from '../store/scenarioStore';
import { en } from '../i18n/en';
import { ja } from '../i18n/ja';
import { nl2br } from '../utils/textUtils';
import type { TranslationKeys } from '../i18n/types';

const translations = {
  en,
  ja,
};

// Update recursive type helper
type PathImpl<T, K extends keyof T> =
  K extends string
  ? T[K] extends Record<string, any>
    ? T[K] extends ArrayLike<any>
      ? K | `${K}.${PathImpl<T[K], Exclude<keyof T[K], keyof any[]>>}`
      : K | `${K}.${PathImpl<T[K], keyof T[K]>}`
    : K
  : never;

type Path<T> = PathImpl<T, keyof T> | keyof T;

// Helper to get nested value
const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
};

export const useTranslation = () => {
  const { language } = useScenarioStore();
  const dict = translations[language];
  
  // Legacy object access (deprecated-ish but kept for compatibility during refactor)


  // New dedicated function access
  const t = (path: Path<TranslationKeys>) => {
      return getNestedValue(dict, path as string);
  };

  const tf = (path: Path<TranslationKeys>) => {
      const text = getNestedValue(dict, path as string);
      return nl2br(text);
  };

  return {
    t, // Export the function 't'
    tf, // Dedicated formatted function
    language,
  };
};

