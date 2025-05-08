import { useState, useEffect } from 'react';

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface TimeTheme {
  timeOfDay: TimeOfDay;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  backgroundColor: string;
  cardColor: string;
  gradientStart: string;
  gradientEnd: string;
}

const themes: Record<TimeOfDay, TimeTheme> = {
  morning: {
    timeOfDay: 'morning',
    primaryColor: '#FF9E44', // Warm orange
    secondaryColor: '#FFD166', // Soft yellow
    accentColor: '#36B3C2', // Sky blue
    textColor: '#333333', 
    backgroundColor: '#F9F7F3', // Warm light background
    cardColor: '#FFFFFF',
    gradientStart: '#FFE8CC', // Sunrise gradient start
    gradientEnd: '#FFB74D', // Sunrise gradient end
  },
  afternoon: {
    timeOfDay: 'afternoon',
    primaryColor: '#3498DB', // Bright blue
    secondaryColor: '#5DADE2', // Light blue
    accentColor: '#F1C40F', // Sunlight yellow
    textColor: '#2C3E50',
    backgroundColor: '#ECF0F1', // Crisp light background
    cardColor: '#FFFFFF',
    gradientStart: '#64B5F6', // Daylight gradient start
    gradientEnd: '#1976D2', // Daylight gradient end
  },
  evening: {
    timeOfDay: 'evening',
    primaryColor: '#8E44AD', // Sunset purple
    secondaryColor: '#9B59B6', // Twilight lavender
    accentColor: '#F39C12', // Warm sunset orange
    textColor: '#ECF0F1',
    backgroundColor: '#34495E', // Twilight blue background
    cardColor: '#2C3E50',
    gradientStart: '#9B59B6', // Sunset gradient start
    gradientEnd: '#E74C3C', // Sunset gradient end
  },
  night: {
    timeOfDay: 'night',
    primaryColor: '#2C3E50', // Dark navy
    secondaryColor: '#34495E', // Blue-gray
    accentColor: '#3498DB', // Electric blue
    textColor: '#ECF0F1',
    backgroundColor: '#1A1A2E', // Deep night background
    cardColor: '#16213E',
    gradientStart: '#0F2027', // Night gradient start
    gradientEnd: '#203A43', // Night gradient end
  }
};

/**
 * Custom hook that returns theme colors based on the current time of day.
 * @returns TimeTheme object with theme colors
 */
export function useTimeTheme(): TimeTheme {
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>('morning');

  useEffect(() => {
    // Determine time of day and set appropriate theme
    const updateTimeOfDay = () => {
      const hours = new Date().getHours();
      
      if (hours >= 5 && hours < 12) {
        setTimeOfDay('morning');
      } else if (hours >= 12 && hours < 17) {
        setTimeOfDay('afternoon');
      } else if (hours >= 17 && hours < 20) {
        setTimeOfDay('evening');
      } else {
        setTimeOfDay('night');
      }
    };

    // Set initial theme
    updateTimeOfDay();

    // Update theme every hour
    const intervalId = setInterval(updateTimeOfDay, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(intervalId);
  }, []);

  return themes[timeOfDay];
}

// Utility function for tests or preview
export function getThemeForTimeOfDay(timeOfDay: TimeOfDay): TimeTheme {
  return themes[timeOfDay];
}

// Export all theme variables
export { themes };
export type { TimeTheme, TimeOfDay };