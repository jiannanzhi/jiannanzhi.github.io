import type { ReaderThemeId } from '../types';

export interface ReaderTheme {
  id: ReaderThemeId;
  label: string;
  paperColor: string;
  chromeColor: string;
  textColor: string;
}

export const READER_THEMES: ReaderTheme[] = [
  {
    id: 'beige',
    label: '米黄',
    paperColor: '#F5EAD8',
    chromeColor: '#F7F1E6',
    textColor: '#4B4035',
  },
  {
    id: 'green',
    label: '草木',
    paperColor: '#EEF4E4',
    chromeColor: '#F3F7EA',
    textColor: '#3E463A',
  },
  {
    id: 'blue',
    label: '晴蓝',
    paperColor: '#E8F1FB',
    chromeColor: '#EEF5FC',
    textColor: '#38424E',
  },
  {
    id: 'pink',
    label: '樱粉',
    paperColor: '#F8E8E8',
    chromeColor: '#F9EFEF',
    textColor: '#4D3D3B',
  },
  {
    id: 'peach',
    label: '杏橙',
    paperColor: '#F6E4D2',
    chromeColor: '#F8ECE0',
    textColor: '#4B3B31',
  },
  {
    id: 'night',
    label: '夜间',
    paperColor: '#1B1B1F',
    chromeColor: '#0F1116',
    textColor: '#D0D5DD',
  },
];

export const getReaderThemeById = (id: ReaderThemeId | string | undefined, preferDark: boolean) => {
  const fallback = READER_THEMES[0];
  if (preferDark) {
    return READER_THEMES.find((theme) => theme.id === 'night') || fallback;
  }
  if (!id) return fallback;
  return READER_THEMES.find((theme) => theme.id === id) || fallback;
};
