import React, { useEffect } from "react";
import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { queryClient } from "@/lib/queryClient";
import { useRealtimeSync } from "@/lib/syncClient";
import { useAuth } from "@/lib/auth";
import { initializeDefaultCategories, processRecurringForDate, getLastProcessedDate, setLastProcessedDate } from "@/lib/localStorage";
import { formatDate } from "@/lib/date-utils";
import DataConflictDialog from "@/components/DataConflictDialog";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import ExpenseTracker from "@/pages/expense-tracker";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ExpenseTracker} />
      <Route>
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-4">Page Not Found</h1>
            <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
          </div>
        </div>
      </Route>
    </Switch>
  );
}

function App() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { 
    conflictDialogOpen,
    pendingConflict, 
    onConflictResolve, 
    onConflictDialogClose 
  } = useRealtimeSync();

  // Listen for toast events from sync client
  useEffect(() => {
    const handleToastEvent = (event: CustomEvent) => {
      const { title, description, variant } = event.detail;
      toast({ title, description, variant });
    };

    window.addEventListener('dailyspend:show-toast', handleToastEvent as EventListener);
    
    return () => {
      window.removeEventListener('dailyspend:show-toast', handleToastEvent as EventListener);
    };
  }, [toast]);

  // Initialize default categories on app start
  useEffect(() => {
    const initializeApp = async () => {
      if (user?.uid) {
        initializeDefaultCategories(user.uid);
        // Invalidate categories query to ensure fresh data is loaded
        await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      }
    };
    
    initializeApp();
  }, [user?.uid]);

  // Process recurring expenses for today on app load (once per day) and schedule midnight processing
  useEffect(() => {
    const processTodayIfNeeded = async () => {
      if (!user?.uid) return;
      
      const todayStr = formatDate(new Date());
      const lastProcessed = getLastProcessedDate(user.uid);
      if (lastProcessed !== todayStr) {
        const added = processRecurringForDate(todayStr, user.uid);
        if (added > 0) {
          await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
        }
        setLastProcessedDate(todayStr, user.uid);
      }
    };

    const scheduleMidnightRun = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      const timeoutId = window.setTimeout(async () => {
        if (!user?.uid) return;
        
        const runDate = formatDate(new Date());
        const added = processRecurringForDate(runDate, user.uid);
        if (added > 0) {
          await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
        }
        setLastProcessedDate(runDate, user.uid);
        // Schedule the next midnight run
        scheduleMidnightRun();
      }, msUntilMidnight);
      return timeoutId;
    };

    if (user?.uid) {
      processTodayIfNeeded();
      const id = scheduleMidnightRun();
      return () => window.clearTimeout(id);
    }
  }, [user?.uid]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <AddToHomeScreen />
        
        {/* Data Conflict Resolution Dialog */}
        {pendingConflict && (
          <DataConflictDialog
            open={conflictDialogOpen}
            onClose={onConflictDialogClose}
            conflict={pendingConflict}
            onResolve={onConflictResolve}
          />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
