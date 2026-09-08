/** Rounds to cents; avoids 0.1 + 0.2 style drift leaking into totals. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatMoney(n: number, currency = 'USD', maximumFractionDigits = 2): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits
  }).format(n)
}

/** Compact form for headline numbers: $1.2k, $54k, $1.3M. */
export function formatCompact(n: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}
