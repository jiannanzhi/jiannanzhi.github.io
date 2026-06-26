import { ApiProvider, ApiConfig, ApiPreset, ApiSamplingParameter, AppSettings, TtsConfig, TtsPreset } from '../../types';

export type SettingsView = 'MAIN' | 'PERSONA' | 'CHARACTER' | 'WORLDBOOK' | 'API' | 'STORAGE' | 'APPEARANCE' | 'TTS';

export interface Persona {
  id: string;
  name: string;
  userNickname: string;
  description: string;
  avatar: string;
  boundCharacterIds: string[];
}

export interface Character {
  id: string;
  name: string;
  nickname: string;
  description: string;
  avatar: string;
  boundWorldBookCategories: string[];
}

export interface WorldBookEntry {
  id: string;
  title: string;
  category: string;
  content: string;
  insertPosition: 'BEFORE' | 'AFTER';
  boundCharacterIds?: string[];
  boundBookIds?: string[];
}

export interface ThemeClasses {
  containerClass: string;
  headingClass: string;
  cardClass: string;
  pressedClass: string;
  sectionIconClass: string;
  inputClass: string;
  btnClass: string;
  activeBorderClass: string;
  baseBorderClass: string;
  animationClass: string;
  isDarkMode: boolean;
}

export type { ApiProvider, ApiConfig, ApiPreset, ApiSamplingParameter, AppSettings, TtsConfig, TtsPreset };
