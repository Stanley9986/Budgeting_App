import { describe, expect, it } from 'vitest'
import { cssVarName, DEFAULT_THEME_ID, getTheme, THEMES, themeCssVars, type ThemeTokens } from '../themes'

/** Relative luminance per WCAG 2.1, for hex colours only. */
function luminance(hex: string): number {
  const m = hex.replace('#', '')
  const rgb = [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16) / 255)
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const REQUIRED_TOKENS: (keyof ThemeTokens)[] = [
  'bg', 'bgElevated', 'bgInput', 'border', 'borderStrong',
  'text', 'textDim', 'textFaint',
  'accent', 'accentContrast', 'accentSoft', 'accent2',
  'green', 'greenSoft', 'greenBorder',
  'yellow', 'yellowSoft', 'yellowBorder',
  'red', 'redSoft', 'redBorder',
  'hover', 'hoverSubtle', 'backdrop'
]

const CASES = THEMES.map((t) => [t.id, t] as const)

describe('theme catalogue', () => {
  it('ships both light and dark options', () => {
    expect(THEMES.filter((t) => t.scheme === 'light').length).toBeGreaterThanOrEqual(2)
    expect(THEMES.filter((t) => t.scheme === 'dark').length).toBeGreaterThanOrEqual(2)
  })

  it('defaults to the warm light brown theme', () => {
    const fallback = getTheme(undefined)
    expect(fallback.id).toBe(DEFAULT_THEME_ID)
    expect(fallback.id).toBe('sand')
    expect(fallback.scheme).toBe('light')
  })

  it('falls back rather than rendering an unknown theme', () => {
    expect(getTheme('not-a-theme').id).toBe(DEFAULT_THEME_ID)
  })

  it('falls back for a retired theme, so an old profile still renders', () => {
    expect(getTheme('espresso').id).toBe(DEFAULT_THEME_ID)
  })

  it('leans warm: most light options are warm-toned', () => {
    // A "warm" surface has more red than blue in it.
    const warmLight = THEMES.filter((t) => {
      if (t.scheme !== 'light') return false
      const [r, , b] = [0, 2, 4].map((i) => parseInt(t.tokens.bg.slice(1 + i, 3 + i), 16))
      return r > b
    })
    expect(warmLight.length).toBeGreaterThanOrEqual(4)
  })

  it('has unique ids', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
  })

  it.each(CASES)('%s defines every token', (_id, theme) => {
    for (const token of REQUIRED_TOKENS) {
      expect(theme.tokens[token], token).toBeTruthy()
    }
  })
})

describe('readability', () => {
  // A budgeting app is read at a glance; body text must clear WCAG AA (4.5:1)
  // and secondary text the large-text bar (3:1) on both surfaces.
  it.each(CASES)('%s keeps body text readable', (_id, theme) => {
    expect(contrast(theme.tokens.text, theme.tokens.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(theme.tokens.text, theme.tokens.bgElevated)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(CASES)('%s keeps dim text legible', (_id, theme) => {
    expect(contrast(theme.tokens.textDim, theme.tokens.bgElevated)).toBeGreaterThanOrEqual(3)
    expect(contrast(theme.tokens.textFaint, theme.tokens.bgElevated)).toBeGreaterThanOrEqual(3)
  })

  it.each(CASES)('%s keeps status colours distinguishable', (_id, theme) => {
    for (const status of ['green', 'yellow', 'red'] as const) {
      expect(contrast(theme.tokens[status], theme.tokens.bgElevated), status).toBeGreaterThanOrEqual(3)
    }
  })

  it.each(CASES)('%s keeps primary button text readable', (_id, theme) => {
    expect(contrast(theme.tokens.accentContrast, theme.tokens.accent)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('themeCssVars', () => {
  it('converts token names to kebab-case custom properties', () => {
    expect(cssVarName('bgElevated')).toBe('--bg-elevated')
    expect(cssVarName('accent2')).toBe('--accent-2')
    expect(cssVarName('bg')).toBe('--bg')
  })

  it('emits one custom property per token', () => {
    const vars = themeCssVars(getTheme('sand'))
    expect(Object.keys(vars)).toHaveLength(REQUIRED_TOKENS.length)
    expect(vars['--bg']).toBe('#f2eae0')
  })
})
