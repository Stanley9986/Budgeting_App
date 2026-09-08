import type { CategoryRule, NewTransaction } from '../types'

/** Most specific match wins; equal-length matches retain their saved order. */
export function applyCategoryRules<T extends NewTransaction>(tx: T, rules: CategoryRule[]): T {
  if (tx.kind !== 'expense' || tx.categoryId) return tx
  const description = tx.description.toLowerCase()
  let rule: CategoryRule | undefined
  let longestMatch = 0
  // One pass avoids sorting the rule set for every imported transaction. Only
  // replacing a strictly shorter match preserves saved order for equal lengths.
  for (const candidate of rules) {
    const phrase = candidate.contains.trim().toLowerCase()
    if (phrase.length > longestMatch && description.includes(phrase)) {
      rule = candidate
      longestMatch = phrase.length
    }
  }
  return rule ? { ...tx, categoryId: rule.categoryId } : tx
}
