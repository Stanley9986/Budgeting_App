import { getTheme, themeCssVars } from '@shared/themes'
import { useEffect } from 'react'

/**
 * Writes the active theme's tokens onto <html> as CSS custom properties. The
 * stylesheet only ever reads var(--token), so switching themes is one pass of
 * setProperty calls with no re-render of anything below.
 */
export function useTheme(themeId: string | undefined): void {
  useEffect(() => {
    const theme = getTheme(themeId)
    const root = document.documentElement
    for (const [name, value] of Object.entries(themeCssVars(theme))) {
      root.style.setProperty(name, value)
    }
    // Tells the OS which way to render scrollbars, form controls and caret.
    root.style.colorScheme = theme.scheme
    root.dataset.theme = theme.id
  }, [themeId])
}
