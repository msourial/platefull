import React, { createContext, useContext, useEffect, useState, PropsWithChildren } from 'react';
import { useTimeTheme, TimeTheme } from '../hooks/use-time-theme';

// Create a context with a default (undefined)
const TimeThemeContext = createContext<TimeTheme | undefined>(undefined);

/**
 * Provider component that wraps the application and provides time-based theming
 */
export function TimeThemeProvider({ children }: PropsWithChildren<{}>) {
  // Get the current time-based theme
  const timeTheme = useTimeTheme();
  
  // Apply the time-based CSS variables when the theme changes
  useEffect(() => {
    // Set the CSS variables
    document.documentElement.style.setProperty('--primary-color', timeTheme.primaryColor);
    document.documentElement.style.setProperty('--secondary-color', timeTheme.secondaryColor);
    document.documentElement.style.setProperty('--accent-color', timeTheme.accentColor);
    document.documentElement.style.setProperty('--text-color', timeTheme.textColor);
    document.documentElement.style.setProperty('--background-color', timeTheme.backgroundColor);
    document.documentElement.style.setProperty('--card-color', timeTheme.cardColor);
    document.documentElement.style.setProperty('--gradient-start', timeTheme.gradientStart);
    document.documentElement.style.setProperty('--gradient-end', timeTheme.gradientEnd);
    
    // Update the background color of the body
    document.body.classList.remove('morning', 'afternoon', 'evening', 'night');
    document.body.classList.add(timeTheme.timeOfDay);
  }, [timeTheme]);
  
  return (
    <TimeThemeContext.Provider value={timeTheme}>
      {children}
    </TimeThemeContext.Provider>
  );
}

/**
 * Hook to access the current time-based theme
 * @returns The current time theme
 */
export const useTimeThemeContext = (): TimeTheme => {
  const context = useContext(TimeThemeContext);
  if (context === undefined) {
    throw new Error('useTimeThemeContext must be used within a TimeThemeProvider');
  }
  return context;
}