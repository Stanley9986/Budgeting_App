import { describe, expect, it } from 'vitest'
import { CATEGORY_PALETTE, migrateCategoryColor, RETIRED_CATEGORY_COLORS } from '../palette'
import { THEMES } from '../themes'

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

function channels(hex: string): number[] {
  const m = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(m.slice(i, i + 2), 16))
}

/** Straight RGB distance — crude, but enough to catch two dots that look alike. */
function distance(a: string, b: string): number {
  const [x, y] = [channels(a), channels(b)]
  return Math.sqrt(x.reduce((sum, v, i) => sum + (v - y[i]) ** 2, 0))
}

describe('category palette', () => {
  it('has no duplicates', () => {
    expect(new Set(CATEGORY_PALETTE).size).toBe(CATEGORY_PALETTE.length)
  })

  it('is long enough to cover every retired palette position', () => {
    expect(CATEGORY_PALETTE.length).toBeGreaterThanOrEqual(8)
  })

  it('never reuses a retired colour', () => {
    for (const color of CATEGORY_PALETTE) {
      expect(RETIRED_CATEGORY_COLORS).not.toContain(color)
    }
  })

  it('keeps every colour visually distinct from every other', () => {
    for (let i = 0; i < CATEGORY_PALETTE.length; i++) {
      for (let j = i + 1; j < CATEGORY_PALETTE.length; j++) {
        expect(
          distance(CATEGORY_PALETTE[i], CATEGORY_PALETTE[j]),
          `${CATEGORY_PALETTE[i]} vs ${CATEGORY_PALETTE[j]}`
        ).toBeGreaterThan(35)
      }
    }
  })

  // These dots are decorative: the category name sits right beside every one, so
  // no information is lost if a dot is hard to see. 1.5:1 is a "still visible as
  // a shape" floor, not the 3:1 WCAG asks of load-bearing UI. The warm yellow
  // lands at ~1.8 on the lightest surface, which is why the bar sits here.
  it('stays visible on the lightest and darkest theme surfaces', () => {
    const surfaces = THEMES.flatMap((t) => [t.tokens.bg, t.tokens.bgElevated])
    const lightest = surfaces.reduce((a, b) => (luminance(a) > luminance(b) ? a : b))
    const darkest = surfaces.reduce((a, b) => (luminance(a) < luminance(b) ? a : b))
    for (const color of CATEGORY_PALETTE) {
      expect(contrast(color, lightest), `${color} on ${lightest}`).toBeGreaterThanOrEqual(1.5)
      expect(contrast(color, darkest), `${color} on ${darkest}`).toBeGreaterThanOrEqual(1.5)
    }
  })
})

describe('migrateCategoryColor', () => {
  it('remaps every colour from every retired palette', () => {
    for (const retired of RETIRED_CATEGORY_COLORS) {
      expect(CATEGORY_PALETTE, retired).toContain(migrateCategoryColor(retired))
    }
  })

  it('remaps a colour from the original cool palette', () => {
    expect(migrateCategoryColor('#7c9cff')).toBe(CATEGORY_PALETTE[0])
  })

  it('remaps a colour from the first warm pass too', () => {
    expect(migrateCategoryColor('#5f7ea5')).toBe(CATEGORY_PALETTE[0])
    expect(migrateCategoryColor('#8c6a55')).toBe(CATEGORY_PALETTE[5])
  })

  it('is case-insensitive about the stored hex', () => {
    expect(migrateCategoryColor('#7C9CFF')).toBe(CATEGORY_PALETTE[0])
  })

  it('leaves a colour the user chose alone', () => {
    expect(migrateCategoryColor('#123456')).toBe('#123456')
  })

  it('is a no-op on a colour already in the new palette', () => {
    for (const color of CATEGORY_PALETTE) {
      expect(migrateCategoryColor(color)).toBe(color)
    }
  })
})
