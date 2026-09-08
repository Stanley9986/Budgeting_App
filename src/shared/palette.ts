/**
 * Colours assigned to spending categories: warm-shifted versions of each hue, so
 * they sit inside the warm default theme instead of fighting it. Blue, green,
 * yellow and purple are the values Stanley picked; the rest were derived to match
 * their saturation and lightness. Kept far enough apart to be told apart as 9px
 * dots — see palette.test.ts.
 */
export const CATEGORY_PALETTE = [
  '#638fa3', // warm blue
  '#6f9b74', // warm green
  '#e2b84b', // warm yellow
  '#c2795c', // warm terracotta
  '#8d71a5', // warm purple
  '#a34e4e', // warm brick
  '#c08a8a', // warm rose
  '#99904f', // warm olive
  '#d9a06a', // warm apricot
  '#4f7a5c' // warm pine
]

/**
 * Palettes this app has shipped before, each index-matched to the current one.
 * Budgets written with an older palette are remapped on load — see the migration
 * in `jsonDatabase.ts` — so an upgrade actually looks different instead of
 * keeping stale colours forever.
 */
const RETIRED_PALETTES = [
  // The original cool palette.
  ['#7c9cff', '#5fd0a4', '#f6c667', '#f2836b', '#c084fc', '#4dd0e1', '#f472b6', '#a3e635'],
  // The first warm pass, before Stanley supplied the four reference hues.
  ['#5f7ea5', '#7f9c62', '#c9942f', '#c8734d', '#a0748f', '#8c6a55', '#c67f7a', '#8d7a4e']
]

/** Retired colour (lower-case hex) -> its replacement in the current palette. */
const REPLACEMENTS = new Map<string, string>(
  RETIRED_PALETTES.flatMap((palette) =>
    palette.map((color, i) => [color, CATEGORY_PALETTE[i]] as [string, string])
  )
)

/**
 * Maps a colour the app itself assigned onto its current replacement. A colour
 * the user picked themselves is not in any retired palette, so it is returned
 * untouched.
 */
export function migrateCategoryColor(color: string): string {
  return REPLACEMENTS.get(color.trim().toLowerCase()) ?? color
}

/** Exposed for tests: every colour a previous release may have written. */
export const RETIRED_CATEGORY_COLORS = RETIRED_PALETTES.flat()
