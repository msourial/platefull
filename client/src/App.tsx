import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Orders from "@/pages/orders";
import Menu from "@/pages/menu";
import Settings from "@/pages/settings";
import { ThemeProvider } from "@/components/ThemeProvider";

function Router() {
  return (
    <Switch>
      {/* Dashboard Pages */}
      <Route path="/" component={Home} />
      <Route path="/orders" component={Orders} />
      <Route path="/menu" component={Menu} />
      <Route path="/settings" component={Settings} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="restaurant-bot-theme">
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
