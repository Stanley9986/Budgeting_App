/** Round decimal cents symmetrically; expense and income totals use the same rule. */
export function round2(n: number): number {
  if (!Number.isFinite(n) || n === 0) return n
  // Shift the decimal exponent before rounding: multiplying 10.075 by 100
  // produces 1007.4999999999999. EPSILON alone also fails at this magnitude.
  const [coefficient, exponent = '0'] = String(Math.abs(n)).split('e')
  const cents = Math.round(Number(`${coefficient}e${Number(exponent) + 2}`))
  if (!Number.isFinite(cents)) return n
  const [wholeCents, centExponent = '0'] = String(cents).split('e')
  const rounded = Number(`${wholeCents}e${Number(centExponent) - 2}`)
  return rounded === 0 ? 0 : Math.sign(n) * rounded
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
