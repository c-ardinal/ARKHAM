import { useScenarioStore } from '../store/scenarioStore';
import { en } from '../i18n/en';
import { ja } from '../i18n/ja';

const translations = {
  en,
  ja,
};

export const useTranslation = () => {
  const { language } = useScenarioStore();
  
  return {
    t: translations[language],
    language,
  };
};
