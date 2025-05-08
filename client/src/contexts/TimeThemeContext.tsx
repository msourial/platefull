import React, { createContext, useContext, PropsWithChildren } from 'react';
import { useTimeTheme, TimeTheme } from '../hooks/use-time-theme';

// Create a context for the time-based theme
const TimeThemeContext = createContext<TimeTheme | null>(null);

/**
 * Provider component that wraps the application and provides time-based theming
 */
export function TimeThemeProvider({ children }: PropsWithChildren<{}>) {
  const theme = useTimeTheme();

  // Apply some global CSS variables based on the current theme
  React.useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', theme.secondaryColor);
    document.documentElement.style.setProperty('--accent-color', theme.accentColor);
    document.documentElement.style.setProperty('--text-color', theme.textColor);
    document.documentElement.style.setProperty('--background-color', theme.backgroundColor);
    document.documentElement.style.setProperty('--card-color', theme.cardColor);
    document.documentElement.style.setProperty('--gradient-start', theme.gradientStart);
    document.documentElement.style.setProperty('--gradient-end', theme.gradientEnd);
  }, [theme]);

  return (
    <TimeThemeContext.Provider value={theme}>
      {children}
    </TimeThemeContext.Provider>
  );
}

/**
 * Hook to access the current time-based theme
 * @returns The current time theme
 */
export function useTimeThemeContext(): TimeTheme {
  const context = useContext(TimeThemeContext);
  
  if (!context) {
    throw new Error('useTimeThemeContext must be used within a TimeThemeProvider');
  }
  
  return context;
}