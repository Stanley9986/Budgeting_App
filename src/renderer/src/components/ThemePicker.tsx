import { THEMES, type ThemeScheme } from '@shared/themes'

export function ThemePicker({
  current,
  onPick,
  disabled = false
}: {
  current: string
  onPick: (id: string) => void
  disabled?: boolean
}): JSX.Element {
  const groups: [string, ThemeScheme][] = [
    ['Light', 'light'],
    ['Dark', 'dark']
  ]

  return (
    <>
      {groups.map(([label, scheme]) => (
        <div key={scheme} style={{ marginBottom: 12 }}>
          <div className="theme-group-label">{label}</div>
          <div className="theme-grid">
            {THEMES.filter((t) => t.scheme === scheme).map((theme) => (
              <button
                key={theme.id}
                type="button"
                disabled={disabled}
                className="theme-swatch"
                aria-pressed={theme.id === current}
                onClick={() => onPick(theme.id)}
              >
                <span className="theme-swatch__preview">
                  <span style={{ background: theme.tokens.bg }} />
                  <span style={{ background: theme.tokens.bgElevated }} />
                  <span style={{ background: theme.tokens.accent }} />
                  <span style={{ background: theme.tokens.green }} />
                </span>
                <span className="theme-swatch__name">
                  {theme.name}
                  {theme.id === current && ' ✓'}
                </span>
                <span className="theme-swatch__desc">{theme.description}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
