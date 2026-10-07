import { useCallback, useState } from 'react';

export type ConsoleTheme = 'light' | 'dark';

const THEME_KEY = 'tesseract.console.theme';

function readTheme(): ConsoleTheme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** The console's colour theme: light by default, remembered per browser. */
export function useConsoleTheme(): [ConsoleTheme, () => void] {
  const [theme, setTheme] = useState<ConsoleTheme>(readTheme);
  const toggle = useCallback(() => {
    setTheme((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* storage unavailable: the choice lasts until reload */
      }
      return next;
    });
  }, []);
  return [theme, toggle];
}

export function consoleClass(theme: ConsoleTheme): string {
  return theme === 'light' ? 'console console--light' : 'console';
}
