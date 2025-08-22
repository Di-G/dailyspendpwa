import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ExpenseTracker from "@/pages/expense-tracker";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import DataConflictDialog from "@/components/DataConflictDialog";
import { useEffect } from "react";
import { useRealtimeSync } from "@/lib/syncClient";
import { initializeDefaultCategories, processRecurringForDate, getLastProcessedDate, setLastProcessedDate, processTripRecurringForDate, getTripLastProcessedDate, setTripLastProcessedDate } from "./lib/localStorage";
import { formatDate } from "./lib/date-utils";

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
  const { 
    conflictDialogOpen, 
    pendingConflict, 
    onConflictResolve, 
    onConflictDialogClose,
    tripsConflictDialogOpen,
    pendingTripsConflict,
    onTripsConflictResolve,
    onTripsConflictDialogClose
  } = useRealtimeSync();

  // Initialize default categories on app start
  useEffect(() => {
    const initializeApp = async () => {
      initializeDefaultCategories();
      // Invalidate categories query to ensure fresh data is loaded
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    };
    
    initializeApp();
  }, []);

  // Global data-changed listener to refresh UI immediately after any local data updates or sync merges
  useEffect(() => {
    const onDataChanged = async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
    };
    window.addEventListener('dailyspend:data-changed', onDataChanged);
    return () => window.removeEventListener('dailyspend:data-changed', onDataChanged);
  }, []);

  // Process recurring expenses for today on app load (once per day) and schedule midnight processing
  useEffect(() => {
    const processTodayIfNeeded = async () => {
      const todayStr = formatDate(new Date());
      const lastProcessed = getLastProcessedDate();
      const tripLastProcessed = getTripLastProcessedDate();
      if (lastProcessed !== todayStr) {
        const added = processRecurringForDate(todayStr);
        if (added > 0) {
          await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
        }
        setLastProcessedDate(todayStr);
      }
      if (tripLastProcessed !== todayStr) {
        const addedTrips = processTripRecurringForDate(todayStr);
        if (addedTrips > 0) {
          // No react-query cache key, trips UI reads localStorage directly
          // Fire a generic data change event to refresh any UI listening
          // (emitDataChanged is used elsewhere; we rely on same onDataChanged listener)
        }
        setTripLastProcessedDate(todayStr);
      }
    };

    const scheduleMidnightRun = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 0, 0);
      const msUntilMidnight = nextMidnight.getTime() - now.getTime();
      const timeoutId = window.setTimeout(async () => {
        const runDate = formatDate(new Date());
        const added = processRecurringForDate(runDate);
        if (added > 0) {
          await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
          await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
        }
        setLastProcessedDate(runDate);
        // Trips recurring at midnight
        const addedTrips = processTripRecurringForDate(runDate);
        if (addedTrips > 0) {
          // trigger UI refresh by emitting data-changed event elsewhere
        }
        setTripLastProcessedDate(runDate);
        // Schedule the next midnight run
        scheduleMidnightRun();
      }, msUntilMidnight);
      return timeoutId;
    };

    processTodayIfNeeded();
    const id = scheduleMidnightRun();
    return () => window.clearTimeout(id);
  }, []);

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

        {pendingTripsConflict && (
          <DataConflictDialog
            open={tripsConflictDialogOpen}
            onClose={onTripsConflictDialogClose}
            conflict={{
              hasLocalData: pendingTripsConflict.hasLocalData,
              hasOnlineData: pendingTripsConflict.hasOnlineData,
              conflicts: {
                // Map to categories/expenses/recurring labels just for display; we override labels below
                categories: pendingTripsConflict.conflicts.trips,
                expenses: pendingTripsConflict.conflicts.tripExpenses,
                recurring: pendingTripsConflict.conflicts.tripRecurring,
              },
              localData: {
                // Pack into expected slots for display counts - use actual trips data
                categories: pendingTripsConflict.localData.trips,
                expenses: pendingTripsConflict.localData.tripExpenses,
                recurring: pendingTripsConflict.localData.tripRecurring,
              },
              onlineData: {
                categories: pendingTripsConflict.onlineData.trips,
                expenses: pendingTripsConflict.onlineData.tripExpenses,
                recurring: pendingTripsConflict.onlineData.tripRecurring,
              },
            }}
            onResolve={onTripsConflictResolve}
            titleOverride="Trips Data Synchronization Required"
            descriptionOverride="We found differences between your local trips and online trips. Please choose how to handle this conflict."
            sectionsLabelOverride={{
              categories: 'Trips',
              expenses: 'Trip Expenses',
              recurring: 'Trip Recurring',
            }}
            allowOutsideClick={true}
          />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
