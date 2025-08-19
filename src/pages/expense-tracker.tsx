import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, Users, Check } from "lucide-react";
import { HiOutlineUserGroup } from "react-icons/hi2";
 
import FollowupsTwoPeopleIcon from "@/components/icons/followups-two-people";
import ExpenseEntry from "@/components/expense-entry";
import ChartsView from "@/components/charts-view";
import CalendarView from "@/components/calendar-view";
import RecurringExpenses from "@/components/recurring-expenses";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import BottomNavigation from "@/components/bottom-navigation";
import FloatingActionButton from "@/components/floating-action-button";
import ThemeToggle from "@/components/theme-toggle";
import Profile from "@/components/profile";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import SettingsDrawer from "@/components/settings-drawer";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { queryClient } from "@/lib/queryClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { getToday } from "@/lib/date-utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type ViewType = "entry" | "charts" | "calendar" | "recurring";
type CurrencyCode = "USD" | "INR";

export default function ExpenseTracker() {
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [topTab, setTopTab] = useState<"my" | "couple" | "trips" | "followups">("my");
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_currency") as CurrencyCode | null;
    return saved || "USD";
  });
  const isMobile = useIsMobile();
  const [focusAmountTrigger, setFocusAmountTrigger] = useState<number | null>(null);
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [overlayTopPx, setOverlayTopPx] = useState<number>(0);
  const [hasPartner, setHasPartner] = useState<boolean>(() => {
    try { return localStorage.getItem("dailyspend_has_partner") === "1"; } catch { return false; }
  });
  const [addPartnerOpen, setAddPartnerOpen] = useState<boolean>(false);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
  }, []);

  // Visual pull-down feedback
  const [pullPx, setPullPx] = useState(0);
  usePullToRefresh(handleRefresh, {
    thresholdPx: 12,
    enabled: true,
    maxPullPx: 64,
    onPullChange: (px, state) => setPullPx(state === "pulling" || state === "refreshing" ? px : 0),
  });

  const handleFabClick = () => {
    setCurrentView("entry");
    setFocusAmountTrigger((t) => (t ?? 0) + 1);
  };

  useEffect(() => {
    const updateOverlayTop = () => {
      if (!tabsContainerRef.current) return;
      const rect = tabsContainerRef.current.getBoundingClientRect();
      setOverlayTopPx(rect.bottom);
    };
    updateOverlayTop();
    window.addEventListener('resize', updateOverlayTop);
    window.addEventListener('scroll', updateOverlayTop, { passive: true });
    return () => {
      window.removeEventListener('resize', updateOverlayTop);
      window.removeEventListener('scroll', updateOverlayTop);
    };
  }, [topTab]);

  // Lock page scroll whenever couple tab is active and no partner is set
  useEffect(() => {
    const shouldLock = topTab === 'couple' && !hasPartner;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    if (shouldLock) {
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
    }
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, [topTab, hasPartner]);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ transform: pullPx ? `translateY(${pullPx}px)` : undefined, transition: pullPx ? "none" : "transform 200ms ease" }}>
      {/* Title Bar */}
      <header className="bg-card shadow-sm border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentView("entry") }>
              <Wallet className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-foreground">Daily Spends</h1>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Profile />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open Settings">
                    <SettingsIcon className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                 <SheetContent side="right" className="bg-card p-0 flex flex-col">
                  <div className="p-6 border-b border">
                    <SheetHeader>
                      <SheetTitle>Settings</SheetTitle>
                    </SheetHeader>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <SettingsDrawer currency={currency} setCurrency={setCurrency} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Nav Bar - Only show on desktop */}
      {!isMobile && (
        <div className="bg-card border-b border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2 sm:space-x-4 h-12">
              <Button
                onClick={() => setCurrentView("entry")}
                size="default"
                className={`${currentView === "entry" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                Home
              </Button>
              <Button
                onClick={() => setCurrentView("calendar")}
                size="default"
                className={`${currentView === "calendar" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar View
              </Button>
              <Button
                onClick={() => setCurrentView("charts")}
                size="default"
                className={`${currentView === "charts" ? "bg-secondary hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Insights
              </Button>
              <Button
                onClick={() => setCurrentView("recurring")}
                size="default"
                className={`${currentView === "recurring" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Recurring
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 ${isMobile ? 'pb-[calc(env(safe-area-inset-bottom)+7rem)]' : ''}`}>
        {/* Top Tabs: below header, above content (edge-to-edge like bottom bar) */}
        <div ref={tabsContainerRef} className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-8 mb-4">
          <Tabs value={topTab} onValueChange={(v) => setTopTab(v as typeof topTab)}>
            <TabsList className="w-full h-16 p-0 rounded-none bg-card border-b border text-gray-600">
              <TabsTrigger
                value="my"
                aria-label="My expenses"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <Wallet className="w-6 h-6" />
                <span className="sr-only">My expenses</span>
              </TabsTrigger>
              <TabsTrigger
                value="couple"
                aria-label="Couple expenses"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <Users className="w-6 h-6" />
                <span className="sr-only">Couple Expenses</span>
              </TabsTrigger>
              <TabsTrigger
                value="trips"
                aria-label="My trips"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <HiOutlineUserGroup className="w-6 h-6" />
                <span className="sr-only">My Trips</span>
              </TabsTrigger>
              <TabsTrigger
                value="followups"
                aria-label="Follow ups"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <div className="relative">
                  <Users className="w-6 h-6" />
                  <span className="absolute -bottom-0 -right-0 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-background ring-2 ring-background">
                    <Check className="w-2 h-2" />
                  </span>
                </div>
                <span className="sr-only">FollowUps</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {topTab === 'my' ? (
          <>
            {currentView === "entry" && (
              <ExpenseEntry
                currency={currency}
                setCurrency={setCurrency}
                focusAmountTrigger={focusAmountTrigger}
                onFocusAmountConsumed={() => setFocusAmountTrigger(null)}
              />
            )}
            {currentView === "charts" && <ChartsView currency={currency} />}
            {currentView === "calendar" && <CalendarView currency={currency} />}
            {currentView === "recurring" && <RecurringExpenses currency={currency} />}
          </>
        ) : topTab === 'couple' ? (
          <div className="relative">
            {/* Visual scaffold to mimic full home layout without data (background content) */}
            <div className="space-y-4 sm:space-y-6">
              {/* Summary card with date and quick stats */}
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1">My Today's Expenses</h2>
                      <div className="flex items-center gap-2">
                        <DatePicker value={getToday()} onChange={() => {}} className="h-8 text-sm" />
                        <span className="text-sm font-medium text-primary">{new Date().toLocaleDateString('en-US', { weekday: 'short' })}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:items-center sm:space-x-6 gap-4 sm:gap-0">
                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Yesterday</p>
                        <p className="text-lg sm:text-xl font-semibold text-foreground">—</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">Today</p>
                        <p className="text-xl sm:text-2xl font-bold text-primary">—</p>
                      </div>
                    </div>
                  </div>

                  {/* Categories Quick Stats (dummy) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-0">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div key={idx} className="border rounded-lg p-2 sm:p-3 text-center bg-muted/20">
                        <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto mb-1 sm:mb-2 bg-muted" />
                        <div className="h-3 w-16 mx-auto bg-muted rounded-sm mb-1" />
                        <div className="h-4 w-20 mx-auto bg-muted rounded-sm" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Add Expense Form (dummy) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <h3 className="text-lg font-semibold text-foreground/80 mb-4">Add New Expense</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="h-10 bg-muted/30 rounded" />
                          <div className="h-10 bg-muted/30 rounded" />
                        </div>
                        <div className="h-10 bg-muted/30 rounded" />
                        <div className="h-24 bg-muted/30 rounded" />
                        <div className="h-10 bg-muted/40 rounded" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Selected Date Expenses List (dummy) */}
              <Card>
                <div className="p-4 sm:p-6 border-b border">
                  <h3 className="text-lg font-semibold text-foreground/80">My Today's Expenses</h3>
                </div>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4">
                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-muted flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="h-4 w-40 bg-muted/40 rounded mb-2" />
                            <div className="h-3 w-24 bg-muted/30 rounded" />
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-3 sm:ml-4">
                          <div className="h-4 w-16 bg-muted/40 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Fixed blur overlay covering everything below top tabs including bottom nav */}
            {!hasPartner && (
              <>
                <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />
                {/* Center CTA above blur */}
                <div className="fixed left-0 right-0 bottom-0 flex items-center justify-center z-[70]" style={{ top: overlayTopPx }}>
                  <Button onClick={() => setAddPartnerOpen(true)} size={isMobile ? 'default' : 'lg'} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Add a Partner/Friend
                  </Button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div />
        )}

        {/* Add Partner Dialog */}
        <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a Partner/Friend</DialogTitle>
            </DialogHeader>
            <div className="text-sm text-muted-foreground">
              This is a placeholder setup. Confirm to mark a partner as added.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>Cancel</Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={() => {
                  setHasPartner(true);
                  try { localStorage.setItem('dailyspend_has_partner', '1'); } catch {}
                  setAddPartnerOpen(false);
                }}
              >
                Add Partner
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Action Button - Mobile only */}
      <FloatingActionButton
        onClick={handleFabClick}
        colorVariant={topTab === 'couple' && !hasPartner ? 'rose' : 'primary'}
        disabled={topTab === 'couple' && !hasPartner}
      />

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v as ViewType)}
        colorVariant={topTab === 'couple' && !hasPartner ? 'rose' : 'primary'}
      />

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />
    </div>
  );
}
