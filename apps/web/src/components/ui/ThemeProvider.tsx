import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type Theme = 'dark' | 'light'

type ThemeContextValue = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const storageKey = 'foititis-theme'

const ThemeContext = createContext<ThemeContextValue | null>(null)

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset.theme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark') {
      setThemeState(stored)
      applyTheme(stored)
      return
    }
    applyTheme('dark')
  }, [])

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme)
    applyTheme(nextTheme)
    window.localStorage.setItem(storageKey, nextTheme)
  }

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

