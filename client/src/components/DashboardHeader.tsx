import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { TimeIndicator } from "./TimeIndicator";
import { useTimeThemeContext } from "../contexts/TimeThemeContext";

export default function DashboardHeader() {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const timeTheme = useTimeThemeContext();

  const isActive = (path: string) => {
    return location === path;
  };

  return (
    <header className="border-b bg-white dark:bg-gray-900">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 bg-restaurant-green rounded-full flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11l18-5v12L3 14v-3z"></path>
                <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
              </svg>
            </span>
            <span className="text-lg font-bold">Restaurant Bot</span>
          </div>
          
          <nav className="hidden md:flex gap-6">
            <Link href="/" className={`text-sm font-medium transition-colors ${isActive('/') ? 'text-restaurant-green' : 'text-muted-foreground hover:text-foreground'}`}>
              Dashboard
            </Link>
            <Link href="/orders" className={`text-sm font-medium transition-colors ${isActive('/orders') ? 'text-restaurant-green' : 'text-muted-foreground hover:text-foreground'}`}>
              Orders
            </Link>
            <Link href="/menu" className={`text-sm font-medium transition-colors ${isActive('/menu') ? 'text-restaurant-green' : 'text-muted-foreground hover:text-foreground'}`}>
              Menu
            </Link>
            <Link href="/settings" className={`text-sm font-medium transition-colors ${isActive('/settings') ? 'text-restaurant-green' : 'text-muted-foreground hover:text-foreground'}`}>
              Settings
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center gap-4">
          <TimeIndicator />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="text-sm">
            Admin
          </Button>
        </div>
      </div>
    </header>
  );
}
