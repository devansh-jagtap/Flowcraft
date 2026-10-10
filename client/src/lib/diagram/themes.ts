import type { ThemeName } from './types';

interface Swatch {
  bg: string;
  fg: string;
  border: string;
}

export interface Theme {
  label: string;
  canvas: string;
  grid: string;
  edge: string;
  step: Swatch;
  terminal: Swatch;
  decision: Swatch;
  /** Colours by tree depth for mind maps and org charts (root first). */
  levels: Swatch[];
}

const s = (bg: string, fg: string, border = bg): Swatch => ({ bg, fg, border });

export const THEMES: Record<ThemeName, Theme> = {
  ocean: {
    label: 'Ocean',
    canvas: '#f4f9ff',
    grid: '#d6e6f7',
    edge: '#5b8db8',
    step: s('#ffffff', '#0c3555', '#3b82c4'),
    terminal: s('#0f5f9e', '#ffffff'),
    decision: s('#e0f2fe', '#0c3555', '#0ea5e9'),
    levels: [s('#0f5f9e', '#fff'), s('#0ea5e9', '#fff'), s('#bae6fd', '#0c3555'), s('#e0f2fe', '#0c3555', '#7dd3fc')],
  },
  sunset: {
    label: 'Sunset',
    canvas: '#fff8f3',
    grid: '#f5ddd0',
    edge: '#c2774f',
    step: s('#ffffff', '#5a2312', '#f08a5d'),
    terminal: s('#e5533d', '#ffffff'),
    decision: s('#ffedd5', '#5a2312', '#f59e0b'),
    levels: [s('#d9480f', '#fff'), s('#f76707', '#fff'), s('#ffc9a9', '#5a2312'), s('#fff1e6', '#5a2312', '#ffa94d')],
  },
  forest: {
    label: 'Forest',
    canvas: '#f5faf6',
    grid: '#d5e8da',
    edge: '#5e8f6c',
    step: s('#ffffff', '#163d25', '#3f9a5f'),
    terminal: s('#1f7a45', '#ffffff'),
    decision: s('#e3f6e8', '#163d25', '#22a35a'),
    levels: [s('#1f6f43', '#fff'), s('#2f9e5c', '#fff'), s('#b7e4c7', '#163d25'), s('#e9f7ee', '#163d25', '#74c69d')],
  },
  grape: {
    label: 'Grape',
    canvas: '#faf7ff',
    grid: '#e5dcf7',
    edge: '#8a6cc6',
    step: s('#ffffff', '#2e1a5c', '#7c5cd6'),
    terminal: s('#6d3fd9', '#ffffff'),
    decision: s('#f1e9ff', '#2e1a5c', '#a07ef0'),
    levels: [s('#5b2fc4', '#fff'), s('#8b5cf6', '#fff'), s('#ddd0fe', '#2e1a5c'), s('#f5f0ff', '#2e1a5c', '#c4b0fa')],
  },
  mono: {
    label: 'Mono',
    canvas: '#fafafa',
    grid: '#e4e4e7',
    edge: '#71717a',
    step: s('#ffffff', '#18181b', '#52525b'),
    terminal: s('#18181b', '#ffffff'),
    decision: s('#f4f4f5', '#18181b', '#3f3f46'),
    levels: [s('#18181b', '#fff'), s('#52525b', '#fff'), s('#e4e4e7', '#18181b'), s('#ffffff', '#18181b', '#a1a1aa')],
  },
};

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export const levelSwatch = (theme: Theme, depth: number) => theme.levels[Math.min(depth, theme.levels.length - 1)];
