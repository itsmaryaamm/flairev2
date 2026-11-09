import { useEffect, useState } from 'react'

const KEY = 'flaire:theme'
export type Theme = 'light' | 'dark'

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function applyTheme(t: Theme) {
  document.documentElement.classList.toggle('dark', t === 'dark')
  const m = document.querySelector('meta[name="theme-color"]')
  if (m) m.setAttribute('content', t === 'dark' ? '#0F0D1A' : '#7B2FF2')
  try { localStorage.setItem(KEY, t) } catch { /* private mode */ }
  window.dispatchEvent(new Event('flaire:theme'))
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(currentTheme())
  useEffect(() => {
    const on = () => setTheme(currentTheme())
    window.addEventListener('flaire:theme', on)
    return () => window.removeEventListener('flaire:theme', on)
  }, [])
  return [theme, () => applyTheme(theme === 'dark' ? 'light' : 'dark')]
}
