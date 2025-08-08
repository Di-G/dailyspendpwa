import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ExpenseTracker from "@/pages/expense-tracker";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import { useEffect } from "react";
import { initializeDefaultCategories } from "./lib/localStorage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ExpenseTracker} />
      <Route>
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h1>
            <p className="text-gray-600">The page you're looking for doesn't exist.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  // Initialize default categories on app start
  useEffect(() => {
    const initializeApp = async () => {
      initializeDefaultCategories();
      // Invalidate categories query to ensure fresh data is loaded
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    };
    
    initializeApp();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <AddToHomeScreen />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
