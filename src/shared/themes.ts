/**
 * Themes are plain data: a token map per theme, applied at runtime as CSS custom
 * properties on <html>. Nothing in the stylesheet knows a theme exists — it only
 * ever reads var(--token) — so adding a theme is adding an entry to this file.
 */

export type ThemeScheme = 'light' | 'dark'

export interface ThemeTokens {
  bg: string
  bgElevated: string
  bgInput: string
  border: string
  borderStrong: string
  text: string
  textDim: string
  textFaint: string
  accent: string
  /** Text drawn on top of `accent` (primary buttons). */
  accentContrast: string
  accentSoft: string
  /** Second stop of the brand gradient in the sidebar mark. */
  accent2: string
  green: string
  greenSoft: string
  greenBorder: string
  yellow: string
  yellowSoft: string
  yellowBorder: string
  red: string
  redSoft: string
  redBorder: string
  hover: string
  hoverSubtle: string
  backdrop: string
}

export interface Theme {
  id: string
  name: string
  description: string
  scheme: ThemeScheme
  tokens: ThemeTokens
}

export const DEFAULT_THEME_ID = 'sand'

export const THEMES: Theme[] = [
  {
    id: 'sand',
    name: 'Sand',
    description: 'Warm light brown',
    scheme: 'light',
    tokens: {
      bg: '#f2eae0',
      bgElevated: '#fbf7f1',
      bgInput: '#ece2d5',
      border: '#e0d3c1',
      borderStrong: '#c7b49a',
      text: '#332a22',
      textDim: '#6b5c4b',
      textFaint: '#93826d',
      accent: '#8a5c2a',
      accentContrast: '#fdf9f3',
      accentSoft: 'rgba(138, 92, 42, 0.14)',
      accent2: '#d9bd94',
      green: '#2f6b45',
      greenSoft: 'rgba(47, 107, 69, 0.13)',
      greenBorder: 'rgba(47, 107, 69, 0.34)',
      yellow: '#8a6412',
      yellowSoft: 'rgba(138, 100, 18, 0.14)',
      yellowBorder: 'rgba(138, 100, 18, 0.34)',
      red: '#a03a2e',
      redSoft: 'rgba(160, 58, 46, 0.12)',
      redBorder: 'rgba(160, 58, 46, 0.32)',
      hover: 'rgba(51, 42, 34, 0.055)',
      hoverSubtle: 'rgba(51, 42, 34, 0.028)',
      backdrop: 'rgba(51, 42, 34, 0.42)'
    }
  },
  {
    id: 'clay',
    name: 'Clay',
    description: 'Warm and rosy',
    scheme: 'light',
    tokens: {
      bg: '#f3e8e2',
      bgElevated: '#fdf6f2',
      bgInput: '#ecdcd4',
      border: '#e3d1c8',
      borderStrong: '#c9ac9f',
      text: '#392c27',
      textDim: '#71584f',
      textFaint: '#9a7d72',
      accent: '#a2543c',
      accentContrast: '#fdf6f2',
      accentSoft: 'rgba(162, 84, 60, 0.14)',
      accent2: '#e0b09a',
      green: '#2f6b45',
      greenSoft: 'rgba(47, 107, 69, 0.13)',
      greenBorder: 'rgba(47, 107, 69, 0.34)',
      yellow: '#8a6412',
      yellowSoft: 'rgba(138, 100, 18, 0.14)',
      yellowBorder: 'rgba(138, 100, 18, 0.34)',
      red: '#a03a2e',
      redSoft: 'rgba(160, 58, 46, 0.12)',
      redBorder: 'rgba(160, 58, 46, 0.32)',
      hover: 'rgba(57, 44, 39, 0.055)',
      hoverSubtle: 'rgba(57, 44, 39, 0.028)',
      backdrop: 'rgba(57, 44, 39, 0.42)'
    }
  },
  {
    id: 'parchment',
    name: 'Parchment',
    description: 'Warm and pale',
    scheme: 'light',
    tokens: {
      bg: '#f7f1e4',
      bgElevated: '#fffcf5',
      bgInput: '#f0e8d8',
      border: '#e8dfcb',
      borderStrong: '#cdc0a4',
      text: '#35301f',
      textDim: '#6d6449',
      textFaint: '#948a6b',
      accent: '#6e6526',
      accentContrast: '#fffcf5',
      accentSoft: 'rgba(110, 101, 38, 0.14)',
      accent2: '#d8c68d',
      green: '#2f6b45',
      greenSoft: 'rgba(47, 107, 69, 0.13)',
      greenBorder: 'rgba(47, 107, 69, 0.34)',
      yellow: '#8a6412',
      yellowSoft: 'rgba(138, 100, 18, 0.14)',
      yellowBorder: 'rgba(138, 100, 18, 0.34)',
      red: '#a03a2e',
      redSoft: 'rgba(160, 58, 46, 0.12)',
      redBorder: 'rgba(160, 58, 46, 0.32)',
      hover: 'rgba(53, 48, 31, 0.055)',
      hoverSubtle: 'rgba(53, 48, 31, 0.028)',
      backdrop: 'rgba(53, 48, 31, 0.42)'
    }
  },
  {
    id: 'olive',
    name: 'Olive',
    description: 'Warm and earthy',
    scheme: 'light',
    tokens: {
      bg: '#eeeee0',
      bgElevated: '#f9f9ee',
      bgInput: '#e5e5d3',
      border: '#dedecb',
      borderStrong: '#bfbfa5',
      text: '#2f3122',
      textDim: '#5f6247',
      textFaint: '#878a6b',
      accent: '#5f6b2e',
      accentContrast: '#f9f9ee',
      accentSoft: 'rgba(95, 107, 46, 0.14)',
      accent2: '#b2bb84',
      green: '#2f6b45',
      greenSoft: 'rgba(47, 107, 69, 0.13)',
      greenBorder: 'rgba(47, 107, 69, 0.34)',
      yellow: '#83610f',
      yellowSoft: 'rgba(131, 97, 15, 0.14)',
      yellowBorder: 'rgba(131, 97, 15, 0.32)',
      red: '#9c3b2f',
      redSoft: 'rgba(156, 59, 47, 0.12)',
      redBorder: 'rgba(156, 59, 47, 0.3)',
      hover: 'rgba(47, 49, 34, 0.055)',
      hoverSubtle: 'rgba(47, 49, 34, 0.028)',
      backdrop: 'rgba(47, 49, 34, 0.42)'
    }
  },
  {
    id: 'paper',
    name: 'Paper',
    description: 'Clean and neutral',
    scheme: 'light',
    tokens: {
      bg: '#f5f5f7',
      bgElevated: '#ffffff',
      bgInput: '#eeeef1',
      border: '#e3e3e8',
      borderStrong: '#c9c9d2',
      text: '#1e1f24',
      textDim: '#585b64',
      textFaint: '#82858f',
      accent: '#2f5fd0',
      accentContrast: '#ffffff',
      accentSoft: 'rgba(47, 95, 208, 0.12)',
      accent2: '#8fb0f5',
      green: '#1c6b45',
      greenSoft: 'rgba(28, 107, 69, 0.12)',
      greenBorder: 'rgba(28, 107, 69, 0.32)',
      yellow: '#8a6100',
      yellowSoft: 'rgba(138, 97, 0, 0.13)',
      yellowBorder: 'rgba(138, 97, 0, 0.32)',
      red: '#a8322a',
      redSoft: 'rgba(168, 50, 42, 0.11)',
      redBorder: 'rgba(168, 50, 42, 0.3)',
      hover: 'rgba(30, 31, 36, 0.05)',
      hoverSubtle: 'rgba(30, 31, 36, 0.025)',
      backdrop: 'rgba(30, 31, 36, 0.42)'
    }
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Soft and green',
    scheme: 'light',
    tokens: {
      bg: '#edf1e9',
      bgElevated: '#f8faf5',
      bgInput: '#e4ebde',
      border: '#d9e1d2',
      borderStrong: '#b6c4ac',
      text: '#283126',
      textDim: '#566151',
      textFaint: '#7d8a77',
      accent: '#3f6b45',
      accentContrast: '#f8faf5',
      accentSoft: 'rgba(63, 107, 69, 0.13)',
      accent2: '#a3c7a2',
      green: '#2f6b45',
      greenSoft: 'rgba(47, 107, 69, 0.13)',
      greenBorder: 'rgba(47, 107, 69, 0.32)',
      yellow: '#836112',
      yellowSoft: 'rgba(131, 97, 18, 0.14)',
      yellowBorder: 'rgba(131, 97, 18, 0.32)',
      red: '#9c3b2f',
      redSoft: 'rgba(156, 59, 47, 0.12)',
      redBorder: 'rgba(156, 59, 47, 0.3)',
      hover: 'rgba(40, 49, 38, 0.055)',
      hoverSubtle: 'rgba(40, 49, 38, 0.028)',
      backdrop: 'rgba(40, 49, 38, 0.42)'
    }
  },
  {
    id: 'mist',
    name: 'Mist',
    description: 'Cool and airy',
    scheme: 'light',
    tokens: {
      bg: '#edf0f4',
      bgElevated: '#f9fbfd',
      bgInput: '#e3e9f0',
      border: '#d9e0e9',
      borderStrong: '#b4c0cf',
      text: '#1c232b',
      textDim: '#525d69',
      textFaint: '#7d8896',
      accent: '#2a6288',
      accentContrast: '#f9fbfd',
      accentSoft: 'rgba(42, 98, 136, 0.13)',
      accent2: '#93c2de',
      green: '#1e6b4e',
      greenSoft: 'rgba(30, 107, 78, 0.12)',
      greenBorder: 'rgba(30, 107, 78, 0.32)',
      yellow: '#856208',
      yellowSoft: 'rgba(133, 98, 8, 0.14)',
      yellowBorder: 'rgba(133, 98, 8, 0.32)',
      red: '#a03a2e',
      redSoft: 'rgba(160, 58, 46, 0.11)',
      redBorder: 'rgba(160, 58, 46, 0.3)',
      hover: 'rgba(28, 35, 43, 0.05)',
      hoverSubtle: 'rgba(28, 35, 43, 0.025)',
      backdrop: 'rgba(28, 35, 43, 0.42)'
    }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Dark and blue',
    scheme: 'dark',
    tokens: {
      bg: '#0f1117',
      bgElevated: '#161923',
      bgInput: '#1c2030',
      border: '#262b3a',
      borderStrong: '#333a4d',
      text: '#e8eaf2',
      textDim: '#98a0b8',
      textFaint: '#6b7391',
      accent: '#7c9cff',
      accentContrast: '#0d1020',
      accentSoft: 'rgba(124, 156, 255, 0.16)',
      accent2: '#a5f3d0',
      green: '#45c98a',
      greenSoft: 'rgba(69, 201, 138, 0.14)',
      greenBorder: 'rgba(69, 201, 138, 0.4)',
      yellow: '#f2c14e',
      yellowSoft: 'rgba(242, 193, 78, 0.14)',
      yellowBorder: 'rgba(242, 193, 78, 0.4)',
      red: '#f06a5d',
      redSoft: 'rgba(240, 106, 93, 0.14)',
      redBorder: 'rgba(240, 106, 93, 0.4)',
      hover: 'rgba(255, 255, 255, 0.045)',
      hoverSubtle: 'rgba(255, 255, 255, 0.022)',
      backdrop: 'rgba(6, 8, 14, 0.66)'
    }
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'Dark and neutral',
    scheme: 'dark',
    tokens: {
      bg: '#131417',
      bgElevated: '#1a1c20',
      bgInput: '#23262b',
      border: '#2b2f35',
      borderStrong: '#3a3f47',
      text: '#e8eaed',
      textDim: '#9ba2ac',
      textFaint: '#727984',
      accent: '#8ab4f8',
      accentContrast: '#10151f',
      accentSoft: 'rgba(138, 180, 248, 0.16)',
      accent2: '#b6d4ff',
      green: '#4fc98a',
      greenSoft: 'rgba(79, 201, 138, 0.14)',
      greenBorder: 'rgba(79, 201, 138, 0.38)',
      yellow: '#efc45f',
      yellowSoft: 'rgba(239, 196, 95, 0.14)',
      yellowBorder: 'rgba(239, 196, 95, 0.38)',
      red: '#f0776d',
      redSoft: 'rgba(240, 119, 109, 0.14)',
      redBorder: 'rgba(240, 119, 109, 0.38)',
      hover: 'rgba(255, 255, 255, 0.045)',
      hoverSubtle: 'rgba(255, 255, 255, 0.022)',
      backdrop: 'rgba(5, 6, 8, 0.66)'
    }
  }
]

export function getTheme(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === DEFAULT_THEME_ID)!
}

/** camelCase token -> --kebab-case CSS custom property. */
export function cssVarName(token: keyof ThemeTokens): string {
  return `--${token.replace(/[A-Z0-9]/g, (m) => `-${m.toLowerCase()}`)}`
}

export function themeCssVars(theme: Theme): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(theme.tokens)) {
    vars[cssVarName(key as keyof ThemeTokens)] = value
  }
  return vars
}
