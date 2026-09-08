import type { CategoryRule, NewTransaction } from '../types'

/** Most specific match wins; equal-length matches retain their saved order. */
export function applyCategoryRules<T extends NewTransaction>(tx: T, rules: CategoryRule[]): T {
  if (tx.kind !== 'expense' || tx.categoryId) return tx
  const description = tx.description.toLocaleLowerCase()
  const rule = rules
    .filter((r) => r.contains.trim() && description.includes(r.contains.toLocaleLowerCase()))
    .sort((a, b) => b.contains.length - a.contains.length)[0]
  return rule ? { ...tx, categoryId: rule.categoryId } : tx
}
