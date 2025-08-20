import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, Users, Check, ChevronLeft, ChevronRight, Repeat, BarChart3 } from "lucide-react";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { formatAmountDisplay } from "@/lib/utils";
 
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
import { getToday, getMonthInfo, generateCalendarDays } from "@/lib/date-utils";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { getCategories, createExpense } from "@/lib/localStorage";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { findVerifiedUserByEmail, createPartnerRequest, subscribeToIncomingRequests, subscribeToOutgoingRequests, updatePartnerRequestStatus, subscribeToAcceptedPartners, subscribeToUserDoc, type PartnerRequest } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import type { Category, Expense, RecurringExpense } from "@shared/schema";

type ViewType = "entry" | "charts" | "calendar" | "recurring" | "chat";
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
  const [hasPartner, setHasPartner] = useState<boolean>(false);
  const [addPartnerOpen, setAddPartnerOpen] = useState<boolean>(false);
  const [partnerName, setPartnerName] = useState<string>("");
  const [partnerEmail, setPartnerEmail] = useState<string>("");
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);
  const [submitMessage, setSubmitMessage] = useState<string>("");
  const [incomingRequests, setIncomingRequests] = useState<PartnerRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PartnerRequest[]>([]);
  const { user, isVerified } = useAuth();
  const [dismissedIncomingPopup, setDismissedIncomingPopup] = useState<boolean>(false);
  const [ackRejectedIds, setAckRejectedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_ack_rejected_outgoing') || '[]'); } catch { return []; }
  });
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [partnerNameResolved, setPartnerNameResolved] = useState<string>("");
  const [partnerData, setPartnerData] = useState<{
    categories: Category[];
    expenses: Expense[];
    recurring: RecurringExpense[];
  } | null>(null);
  const stopPartnerDocRef = useRef<null | (() => void)>(null);
  const [confirmCopyOpen, setConfirmCopyOpen] = useState<boolean>(false);
  const [customCopyOpen, setCustomCopyOpen] = useState<boolean>(false);
  const [hasAcceptedRequest, setHasAcceptedRequest] = useState<boolean>(false);
  const [copySourceDate, setCopySourceDate] = useState<string>(getToday());
  const [copyDestDate, setCopyDestDate] = useState<string>(getToday());
  const [currentPartnerDate, setCurrentPartnerDate] = useState<string>(getToday());

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
  }, []);

  // Handle partner removal from settings
  const handlePartnerRemoved = useCallback((requestId: string) => {
    // Find if this was an accepted partner request
    const acceptedPartners = [...outgoingRequests, ...incomingRequests].filter(r => r.status === 'accepted');
    const removedPartner = acceptedPartners.find(r => r.id === requestId);
    
    if (removedPartner) {
      // This was an accepted partner, update the app state
      setHasPartner(false);
      setPartnerUid(null);
      setPartnerData(null);
      setPartnerNameResolved("");
      
      // Stop the partner document subscription
      try { stopPartnerDocRef.current?.(); } catch {}
      stopPartnerDocRef.current = null;
    }
  }, [outgoingRequests, incomingRequests]);

  // Visual pull-down feedback
  const [pullPx, setPullPx] = useState(0);
  usePullToRefresh(handleRefresh, {
    thresholdPx: 12,
    enabled: true,
    maxPullPx: 64,
    onPullChange: (px, state) => setPullPx(state === "pulling" || state === "refreshing" ? px : 0),
  });

  const handleFabClick = () => {
    if (topTab === 'couple') {
      if (hasPartner && partnerData) {
        // If viewing a specific date in partner view, use that as source
        if (currentView === 'entry' && partnerData) {
          // Use the currently selected date from partner view
          setCopySourceDate(currentPartnerDate);
          setCopyDestDate(getToday()); // Default destination to today
          setCustomCopyOpen(true);
          return;
        }
        // For other views, show the today confirmation
        setConfirmCopyOpen(true);
      }
      return;
    }
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

  // Ensure old persisted state does not disable the blur
  useEffect(() => {
    setHasPartner(false);
    try { localStorage.removeItem('dailyspend_has_partner'); } catch {}
  }, []);
  // Subscribe to partner request inbox/outbox when verified
  useEffect(() => {
    let stopIn: null | (() => void) = null;
    let stopOut: null | (() => void) = null;
    if (user && isVerified) {
      stopIn = subscribeToIncomingRequests(user.uid, setIncomingRequests);
      stopOut = subscribeToOutgoingRequests(user.uid, setOutgoingRequests);
    }
    return () => {
      try { stopIn?.(); } catch {}
      try { stopOut?.(); } catch {}
    };
  }, [user?.uid, isVerified]);

  // Subscribe to accepted partners and bind to partner's user doc for read-only data
  useEffect(() => {
    if (!user || !isVerified) return;
    let stopPartners: null | (() => void) = null;
    stopPartners = subscribeToAcceptedPartners(user.uid, async (accepted) => {
      if (!accepted.length) {
        setHasPartner(false);
        setPartnerUid(null);
        setPartnerData(null);
        setHasAcceptedRequest(false); // Reset accepted request flag
        try { stopPartnerDocRef.current?.(); } catch {}
        stopPartnerDocRef.current = null;
        return;
      }
      
      // Find if user is a "leader" (sent request) or "follower" (accepted request)
      const userSentRequest = accepted.find(r => r.fromUid === user.uid);
      const userAcceptedRequest = accepted.find(r => r.toUid === user.uid);
      
      // If user is a follower (accepted someone else's request), they don't have a partner to view
      // They should see the skeleton screen to add their own partner
      if (userAcceptedRequest && !userSentRequest) {
        setHasPartner(false);
        setPartnerUid(null);
        setPartnerData(null);
        setHasAcceptedRequest(true); // Mark that user has accepted a request
        try { stopPartnerDocRef.current?.(); } catch {}
        stopPartnerDocRef.current = null;

        return;
      }
      
      // If user is a leader (sent request), show their partner's data
      // Find all accepted requests where user is the sender
      const userSentRequests = accepted.filter(r => r.fromUid === user.uid);
      if (userSentRequests.length > 0) {
        // Show the first available partner (or next one if current was removed)
        const currentPartner = userSentRequests[0];
        const otherUid = currentPartner.toUid;
        setHasPartner(true);
        setPartnerUid(otherUid);
        setPartnerNameResolved(currentPartner.toName || currentPartner.toEmail);

        try { stopPartnerDocRef.current?.(); } catch {}
        stopPartnerDocRef.current = subscribeToUserDoc(otherUid, (data) => {
          if (!data) {
            setPartnerData({ categories: [], expenses: [], recurring: [] });
            return;
          }
          setPartnerData({
            categories: (data.categories as any[]) || [],
            expenses: (data.expenses as any[]) || [],
            recurring: (data.recurring as any[]) || [],
          });
        });
      }
    });
    return () => {
      try { stopPartners?.(); } catch {}
      try { stopPartnerDocRef.current?.(); } catch {}
      stopPartnerDocRef.current = null;
    };
  }, [user?.uid, isVerified, hasAcceptedRequest]);

  const hasPendingIncoming = useMemo(() => incomingRequests.some(r => r.status === 'pending'), [incomingRequests]);
  const pendingOutgoing = useMemo(() => outgoingRequests.filter(r => r.status === 'pending'), [outgoingRequests]);
  const rejectedOutgoing = useMemo(() => outgoingRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled'), [outgoingRequests]);
  const rejectedUnseen = useMemo(() => rejectedOutgoing.filter(r => !ackRejectedIds.includes(r.id)), [rejectedOutgoing, ackRejectedIds]);

  // Mark rejected notifications as seen when leaving the couple tab
  const prevTopTabRef = useRef(topTab);
  useEffect(() => {
    const prev = prevTopTabRef.current;
    if (prev === 'couple' && topTab !== 'couple' && rejectedUnseen.length > 0) {
      const next = Array.from(new Set([...ackRejectedIds, ...rejectedUnseen.map(r => r.id)]));
      setAckRejectedIds(next);
      try { localStorage.setItem('dailyspend_ack_rejected_outgoing', JSON.stringify(next)); } catch {}
    }
    prevTopTabRef.current = topTab;
  }, [topTab, rejectedUnseen.length]);



  const handleOpenAddPartner = () => {
    if (!isVerified) {
      setSubmitMessage("This functionality is only available to verified users. Please verify your email in Profile.");
      setAddPartnerOpen(true);
      return;
    }
    setSubmitMessage("Enter your partner's name and email. The user must be verified for you to add them.");
    setAddPartnerOpen(true);
  };

  const handleTopTabChange = (v: string) => {
    if (v === 'couple' && !isVerified) {
      setSubmitMessage("This functionality is only available to verified users. Please verify your email in Profile.");
      setAddPartnerOpen(true);
      setTopTab('my');
      return;
    }
    

    
    setTopTab(v as typeof topTab);
  };

  const handleSubmitPartner = async () => {
    if (!user) return;
    setSubmitMessage("");
    const name = partnerName.trim();
    const email = partnerEmail.trim();
    if (!name || !email) {
      setSubmitMessage("Please enter both name and email address.");
      return;
    }
    if (email.toLowerCase() === (user.email || "").toLowerCase()) {
      setSubmitMessage("You cannot add yourself as a friend.");
      return;
    }
    setSubmitLoading(true);
    try {
      const found = await findVerifiedUserByEmail(email);
      if (!found) {
        setSubmitMessage("No verified user found with that email.");
        return;
      }
      const req = await createPartnerRequest({
        fromUid: user.uid,
        fromEmail: user.email || "",
        fromName: user.displayName || "",
        toUid: found.uid,
        toEmail: found.email,
        toName: name,
      });
      // Close dialog on success and clear fields; the overlay will show pending requests on page
      setPartnerName("");
      setPartnerEmail("");
      setAddPartnerOpen(false);
    } catch (e) {
      setSubmitMessage("Failed to send request. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleIncomingAction = async (req: PartnerRequest, action: 'accept' | 'reject') => {
    await updatePartnerRequestStatus(req.id, action === 'accept' ? 'accepted' : 'rejected');
  };


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
                  <Button variant="ghost" size="icon" aria-label="Open Settings" className="relative">
                    <SettingsIcon className="w-5 h-5" />
                    {hasPendingIncoming && (
                      <span className="absolute -top-0 -right-0 inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" title="Pending partner requests" />
                    )}
                  </Button>
                </SheetTrigger>
                 <SheetContent side="right" className="bg-card p-0 flex flex-col">
                  <div className="p-6 border-b border">
                    <SheetHeader>
                      <SheetTitle>Settings</SheetTitle>
                    </SheetHeader>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <SettingsDrawer 
          currency={currency} 
          setCurrency={setCurrency} 
          topTab={topTab}
          onPartnerRemoved={handlePartnerRemoved}
        />
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
          <Tabs value={topTab} onValueChange={handleTopTabChange}>
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
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-none relative"
              >
                <div className="relative">
                  <Users className="w-6 h-6" />
                </div>
                {rejectedUnseen.length > 0 && (
                  <span className="absolute top-3 right-3 inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" title="Recent partner request was rejected" />
                )}
                {incomingRequests.some(r => r.status === 'pending') && (
                  <span className="absolute top-3 right-6 inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500" title="Incoming partner request" />
                )}
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
            {/* If no accepted partner yet, show placeholder content + overlay and CTA */}
            {!hasPartner && (
              <>
                {/* Visual scaffold to mimic a fresh home layout without data (dummy copy) */}
                <div className="space-y-4 sm:space-y-6">
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
                      {(() => {
                        const mockCategories = [
                          { id: 'food', name: 'Food', color: '#EF4444' },
                          { id: 'travel', name: 'Travel', color: '#3B82F6' },
                          { id: 'groceries', name: 'Groceries', color: '#10B981' },
                          { id: 'shopping', name: 'Shopping', color: '#F59E0B' },
                          { id: 'entertain', name: 'Entertainment', color: '#8B5CF6' },
                          { id: 'health', name: 'Health', color: '#EC4899' },
                          { id: 'bills', name: 'Bills', color: '#06B6D4' },
                          { id: 'other', name: 'Other', color: '#94A3B8' },
                        ];
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-0">
                            {mockCategories.map((category) => (
                              <div
                                key={category.id}
                                className="border rounded-lg p-2 sm:p-3 text-center"
                                style={{ backgroundColor: `${category.color}10`, borderColor: `${category.color}40` }}
                              >
                                <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto mb-1 sm:mb-2" style={{ backgroundColor: category.color }} />
                                <div className="h-3 w-16 mx-auto rounded-sm mb-1" style={{ backgroundColor: `${category.color}30` }} />
                                <div className="h-4 w-20 mx-auto rounded-sm" style={{ backgroundColor: `${category.color}20` }} />
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="lg:col-span-2">
                      <Card>
                        <CardContent className="p-4 sm:p-6">
                          <h3 className="text-lg font-semibold text-foreground/80 mb-4">Add New Expense</h3>
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="h-10 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                              <div className="h-10 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                            </div>
                            <div className="h-10 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                            <div className="h-24 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                            <div className="h-10 rounded" style={{ backgroundColor: '#D1D5DB' }} />
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                  <Card>
                    <div className="p-4 sm:p-6 border-b border">
                      <h3 className="text-lg font-semibold text-foreground/80">My Today's Expenses</h3>
                    </div>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div key={idx} className="flex items-center justify-between p-4">
                            <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border" style={{ backgroundColor: '#E5E7EB', borderColor: '#CBD5E1' }} />
                              <div className="min-w-0 flex-1">
                                <div className="h-4 w-40 rounded mb-2" style={{ backgroundColor: '#E5E7EB' }} />
                                <div className="h-3 w-24 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                              </div>
                            </div>
                            <div className="flex-shrink-0 ml-3 sm:ml-4">
                              <div className="h-4 w-16 rounded" style={{ backgroundColor: '#E5E7EB' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Blur overlay */}
                <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />
                                {/* CTA above blur */}
                <div className="fixed left-0 right-0 bottom-0 flex flex-col items-center justify-center gap-2 z-[80]" style={{ top: overlayTopPx }}>
                  <Button onClick={handleOpenAddPartner} size={isMobile ? 'default' : 'lg'} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Add a Partner/Friend
                  </Button>
                  {pendingOutgoing.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs sm:text-sm px-3 py-2">
                      Partner request sent to {(pendingOutgoing.map(r => r.toName || r.toEmail)).join(', ')} — waiting for approval
                    </div>
                  )}
                  {rejectedUnseen.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm px-3 py-2">
                      {(rejectedUnseen.map(r => r.toName || r.toEmail)).join(', ')} didn't approve your partner request.
                    </div>
                  )}
                  {/* Show message for users who accepted partner requests */}
                  {(() => {
                    const userAcceptedRequest = outgoingRequests.find(r => r.status === 'accepted' && r.toUid === user?.uid);
                    if (userAcceptedRequest) {
                      return (
                        <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-xs sm:text-sm px-3 py-2">
                          You're connected with {userAcceptedRequest.fromName || userAcceptedRequest.fromEmail}. Add your own partner to start sharing expenses.
                        </div>
                        );
                      }
                      return null;
                    })()}
                </div>

                {/* Chat/Insights button for users who accepted partner requests */}
                {hasAcceptedRequest && (
                  <div className="fixed bottom-0 right-0 z-[85] pb-[env(safe-area-inset-bottom)]">
                    <button
                      onClick={() => setCurrentView(topTab === 'couple' ? 'chat' : 'charts')}
                      style={{ width: '25vw' }}
                      className="h-16 flex flex-col items-center justify-center transition-all duration-200 bg-rose-600 text-white"
                    >
                      {topTab === 'couple' ? (
                        <Users className="w-5 h-5 mb-1 text-white" />
                      ) : (
                        <BarChart3 className="w-5 h-5 mb-1 text-white" />
                      )}
                      <span className="text-xs font-medium text-white">
                        {topTab === 'couple' ? 'Chat' : 'Insights'}
                      </span>
                    </button>
                  </div>
                )}


              </>
            )}

            {/* Partner read-only views when accepted */}
            {hasPartner && (
              <>
                {!partnerData ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading {partnerNameResolved ? `${partnerNameResolved}'s` : 'partner'} data…</div>
                ) : (
                  <>
                    {currentView === 'entry' && (
                      <PartnerHomeReadOnly currency={currency} data={partnerData} setCurrentPartnerDate={setCurrentPartnerDate} />
                    )}
                    {currentView === 'calendar' && (
                      <PartnerCalendarReadOnly currency={currency} data={partnerData} />
                    )}
                    {currentView === 'recurring' && (
                      <PartnerRecurringReadOnly currency={currency} data={partnerData} />
                    )}
                    {currentView === 'charts' && (
                      <div className="p-4 text-sm text-muted-foreground">Charts for partner will be available soon.</div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Content views for users who accepted partner requests (follower users) */}
            {!hasPartner && hasAcceptedRequest && (
              <>
                {currentView === 'entry' && (
                  <div className="p-4 text-sm text-muted-foreground">Add your own partner to start sharing expenses.</div>
                )}
                {currentView === 'calendar' && (
                  <div className="p-4 text-sm text-muted-foreground">Add your own partner to start sharing expenses.</div>
                )}
                {currentView === 'recurring' && (
                  <div className="p-4 text-sm text-muted-foreground">Add your own partner to start sharing expenses.</div>
                )}
                {currentView === 'charts' && (
                  <div className="p-4 text-sm text-muted-foreground">Add your own partner to start sharing expenses.</div>
                )}
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
            {!!submitMessage && (
              <Alert className="mb-2">
                <AlertTitle>Status</AlertTitle>
                <AlertDescription>{submitMessage}</AlertDescription>
              </Alert>
            )}
            {isVerified && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Name</label>
                  <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Enter partner's name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)} placeholder="Enter partner's email" type="email" />
                </div>
                <p className="text-xs text-muted-foreground">The user must be verified for you to add them as a partner.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>Close</Button>
              {isVerified && (
                <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleSubmitPartner} disabled={submitLoading}>
                  {submitLoading ? "Sending..." : "Send Request"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Floating Action Button - Mobile only */}
      <FloatingActionButton
        onClick={handleFabClick}
        colorVariant={topTab === 'couple' ? 'rose' : 'primary'}
        disabled={topTab === 'couple' && !hasPartner}
      />

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation
        currentView={hasAcceptedRequest && topTab === 'couple' && !hasPartner ? 'none' : currentView}
        onViewChange={(v) => setCurrentView(v as ViewType)}
        colorVariant={topTab === 'couple' ? 'rose' : 'primary'}
        isCoupleTab={topTab === 'couple'}
      />

      {/* Incoming partner request popup when user opens app */}
      {isVerified && !dismissedIncomingPopup && incomingRequests.some(r => r.status === 'pending') && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40">
          <div className="bg-card border rounded-lg p-4 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Partner Request</h3>
            {incomingRequests.filter(r => r.status === 'pending').slice(0,1).map(r => (
              <div key={r.id} className="space-y-2">
                <p className="text-sm">{r.fromName || r.fromEmail} wants to add you as a partner in their expenses.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setDismissedIncomingPopup(true)}>Close</Button>
                  <Button variant="destructive" onClick={() => handleIncomingAction(r, 'reject')}>Reject</Button>
                  <Button onClick={() => handleIncomingAction(r, 'accept')}>Accept</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />

      {/* Couple tab: confirm copy partner today's expenses */}
      <AlertDialog open={confirmCopyOpen} onOpenChange={setConfirmCopyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add partner's today's expenses?</AlertDialogTitle>
            <AlertDialogDescription>
              {`Copy all of ${partnerNameResolved || 'partner'}'s expenses for today into your today.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border bg-gradient-to-br from-rose-500/10 to-pink-500/10 p-3 mt-2">
            <div className="text-sm text-foreground">
              {`Copy all of ${partnerNameResolved || 'partner'}'s expenses for`}{' '}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">
                Today
              </span>{' '}
              into your
              {' '}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-medium">
                Today
              </span>
              .
            </div>
          </div>
          <AlertDialogFooter>
            <button
              className="text-sm px-3 py-2 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setConfirmCopyOpen(false);
                setCopySourceDate(getToday());
                setCopyDestDate(getToday());
                setCustomCopyOpen(true);
              }}
            >
              More options
            </button>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                try {
                  const today = getToday();
                  const partnerToday = (partnerData?.expenses || []).filter(e => e.date === today);
                  if (partnerToday.length === 0) return;
                  // Ensure categories exist locally; if missing, create a fallback 'Uncategorized'
                  const myCategories = getCategories();
                  const uncategorizedId = (() => {
                    const found = myCategories.find(c => c.id === 'uncategorized');
                    return found ? found.id : null;
                  })();
                  partnerToday.forEach((e) => {
                    createExpense({
                      name: e.name,
                      amount: e.amount,
                      details: e.details || undefined,
                      categoryId: e.categoryId || uncategorizedId || undefined,
                      date: today,
                    });
                  });
                } finally {
                  setConfirmCopyOpen(false);
                }
              }}
            >
              Add Today's
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Couple tab: custom copy dialog */}
      <Dialog open={customCopyOpen} onOpenChange={setCustomCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy partner expenses</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-sm font-medium">From partner date</label>
              <div className="mt-1 rounded-md border bg-muted/20 p-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Calendar className="w-3 h-3" /> Partner date
                </div>
                <DatePicker value={copySourceDate} onChange={(v: string) => setCopySourceDate(v)} />
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {(partnerData?.expenses || []).filter(e => e.date === copySourceDate).length} expense(s) on this date
                </div>
                {copySourceDate === getToday() && (
                  <div className="mt-2 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-semibold">
                      Today
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">To my date</label>
              <div className="mt-1 rounded-md border bg-muted/20 p-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Calendar className="w-3 h-3" /> My date
                </div>
                <DatePicker value={copyDestDate} onChange={(v: string) => setCopyDestDate(v)} />
                {copyDestDate === getToday() && (
                  <div className="mt-2 text-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-sm font-semibold">
                      Today
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Special highlight when both dates are Today */}
            {copySourceDate === getToday() && copyDestDate === getToday() && (
              <div className="rounded-lg border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30 p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-2xl">🎯</span>
                  <span className="text-lg font-bold text-green-800 dark:text-green-200">Today → Today</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-300">
                  Copying partner's today's expenses to your today
                </div>
              </div>
            )}
            
            {/* Preview of expenses to be copied */}
            {(() => {
              const sourceExpenses = (partnerData?.expenses || []).filter(e => e.date === copySourceDate);
              const categoryById = new Map<string, Category>();
              (partnerData?.categories || []).forEach(c => categoryById.set(c.id, c));
              
              if (sourceExpenses.length === 0) return null;
              
              return (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-sm font-medium text-foreground mb-3 text-center">
                    Preview: {sourceExpenses.length} expense(s) to copy
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {sourceExpenses.map((exp) => (
                      <div key={exp.id} className="flex items-center justify-between text-sm bg-background rounded-full px-3 py-2 border border-border shadow-sm">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate text-foreground">{exp.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {categoryById.get(exp.categoryId || '')?.name || 'Uncategorized'}
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2 text-sm font-semibold text-foreground">
                          {currency === 'INR' ? '₹' : '$'}{parseFloat(exp.amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomCopyOpen(false)}>Cancel</Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={() => {
                try {
                  const items = (partnerData?.expenses || []).filter(e => e.date === copySourceDate);
                  if (items.length === 0) return;
                  const myCategories = getCategories();
                  const uncategorizedId = (() => {
                    const found = myCategories.find(c => c.id === 'uncategorized');
                    return found ? found.id : null;
                  })();
                  items.forEach((e) => {
                    createExpense({
                      name: e.name,
                      amount: e.amount,
                      details: e.details || undefined,
                      categoryId: e.categoryId || uncategorizedId || undefined,
                      date: copyDestDate,
                    });
                  });
                } finally {
                  setCustomCopyOpen(false);
                }
              }}
            >
              Copy expenses
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnerHomeReadOnly({ currency, data, setCurrentPartnerDate }: { currency: CurrencyCode; data: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] }; setCurrentPartnerDate: (date: string) => void }) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [copyExpenseDialogOpen, setCopyExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [customDate, setCustomDate] = useState(getToday());
  const { toast } = useToast();

  // Update parent state when selectedDate changes
  useEffect(() => {
    setCurrentPartnerDate(selectedDate);
  }, [selectedDate, setCurrentPartnerDate]);

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setCopyExpenseDialogOpen(true);
    setShowMoreOptions(false);
    setCustomDate(getToday());
  };

  const getYesterdayForDate = (date: string) => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };

  const handleCopyExpense = async (useCustomDate = false) => {
    if (!selectedExpense) return;
    
    setCopyLoading(true);
    try {
      const targetDate = useCustomDate ? customDate : getToday();
      
      // Create a new expense with the specified date
      await createExpense({
        name: selectedExpense.name,
        amount: selectedExpense.amount,
        details: selectedExpense.details ?? undefined,
        categoryId: selectedExpense.categoryId ?? undefined,
        date: targetDate,
      });
      
      const dateDescription = useCustomDate ? 
        `your expenses for ${new Date(customDate).toLocaleDateString()}` : 
        "your today's expenses";
      
      toast({ 
        title: "Expense copied!", 
        description: `${selectedExpense.name} has been added to ${dateDescription}.` 
      });
      
      setCopyExpenseDialogOpen(false);
      setSelectedExpense(null);
      setShowMoreOptions(false);
      setCustomDate(getToday()); // Reset custom date
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to copy expense. Please try again." 
      });
    } finally {
      setCopyLoading(false);
    }
  };

  const CURRENCIES = { USD: { symbol: "$" }, INR: { symbol: "₹" } } as const;
  const symbol = CURRENCIES[currency].symbol;

  const expensesForDate = useMemo(() => data.expenses.filter(e => e.date === selectedDate), [data.expenses, selectedDate]);
  const totalForDate = useMemo(() => expensesForDate.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0), [expensesForDate]);
  const yesterday = getYesterdayForDate(selectedDate);
  const yesterdayTotal = useMemo(() => data.expenses.filter(e => e.date === yesterday).reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0), [data.expenses, yesterday]);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    data.categories.forEach(c => map.set(c.id, c));
    return map;
  }, [data.categories]);

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, { total: number; category: Category }>();
    expensesForDate.forEach(e => {
      const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
      const key = cat ? cat.id : 'uncategorized';
      const category: Category = cat || { id: 'uncategorized', name: 'Uncategorized', color: '#94A3B8', createdAt: '' } as any;
      const prev = totals.get(key);
      const nextTotal = (prev?.total || 0) + parseFloat(e.amount || '0');
      totals.set(key, { total: nextTotal, category });
    });
    return Array.from(totals.values());
  }, [expensesForDate, categoryById]);



  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1">Partner's Today's Expenses</h2>
              <div className="flex items-center gap-2">
                <DatePicker value={selectedDate} onChange={(v: string) => setSelectedDate(v)} className="h-8 text-sm" />
                <span className="text-sm font-medium text-primary">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">Today</p>
              <p className="text-xl sm:text-2xl font-bold text-primary">{symbol}{formatAmountDisplay(totalForDate)}</p>
            </div>
          </div>
          {categoryTotals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-0">
              {categoryTotals.map(({ category, total }) => (
                <div key={category.id} className="border rounded-lg p-2 sm:p-3 text-center" style={{ backgroundColor: `${category.color}10`, borderColor: `${category.color}40` }}>
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto mb-1 sm:mb-2" style={{ backgroundColor: category.color }} />
                  <div className="text-xs font-medium text-muted-foreground mb-1 truncate">{category.name}</div>
                  <div className="text-sm font-semibold">{symbol}{formatAmountDisplay(total)}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <div className="p-4 sm:p-6 border-b border">
          <h3 className="text-lg font-semibold text-foreground/80">Partner's Expenses</h3>
        </div>
        <CardContent className="p-0">
          {expensesForDate.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No expenses for the selected date.</div>
          ) : (
            <div className="divide-y">
              {expensesForDate.map((exp) => (
                <div 
                  key={exp.id} 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => handleExpenseClick(exp)}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 border" style={{ backgroundColor: (exp.categoryId && categoryById.get(exp.categoryId)?.color) || '#E5E7EB', borderColor: '#CBD5E1' }} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{exp.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{categoryById.get(exp.categoryId || '')?.name || 'Uncategorized'}</div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3 sm:ml-4 text-sm font-semibold">{symbol}{formatAmountDisplay(parseFloat(exp.amount || '0'))}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Copy Expense Confirmation Dialog */}
      <Dialog open={copyExpenseDialogOpen} onOpenChange={setCopyExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Expense</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: (selectedExpense.categoryId && categoryById.get(selectedExpense.categoryId)?.color) || '#E5E7EB', borderColor: '#CBD5E1' }} />
                    <div>
                      <div className="font-medium">{selectedExpense.name}</div>
                      <div className="text-sm text-muted-foreground">{categoryById.get(selectedExpense.categoryId || '')?.name || 'Uncategorized'}</div>
                    </div>
                  </div>
                  <div className="font-semibold">{symbol}{formatAmountDisplay(parseFloat(selectedExpense.amount || '0'))}</div>
                </div>
                {selectedExpense.details && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {selectedExpense.details}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => handleCopyExpense(false)} 
                    disabled={copyLoading}
                    className="bg-rose-600 hover:bg-rose-700 w-full"
                  >
                    {copyLoading ? "Adding..." : "Add to Today's Expenses"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="w-full"
                  >
                    {showMoreOptions ? "Hide Options" : "More Options"}
                  </Button>
                </div>

                {/* More Options */}
                {showMoreOptions && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Choose a custom date:</label>
                      <DatePicker 
                        value={customDate} 
                        onChange={setCustomDate}
                        className="w-full"
                      />
                    </div>
                    <Button 
                      onClick={() => handleCopyExpense(true)} 
                      disabled={copyLoading}
                      className="bg-blue-600 hover:bg-blue-700 w-full"
                    >
                      {copyLoading ? "Adding..." : `Add to ${new Date(customDate).toLocaleDateString()}`}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyExpenseDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnerCalendarReadOnly({ currency, data }: { currency: CurrencyCode; data: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] } }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [previewItems, setPreviewItems] = useState<Array<{ name: string; amount: string }>>([]);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  const [copyExpenseDialogOpen, setCopyExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [customDate, setCustomDate] = useState(getToday());
  const { toast } = useToast();
  const monthInfo = getMonthInfo(currentDate);
  const calendarDays = generateCalendarDays(monthInfo.year, monthInfo.month - 1);

  const CURRENCIES = { USD: { symbol: "$" }, INR: { symbol: "₹" } } as const;

  const monthlyTotals = useMemo(() => {
    const map = new Map<string, number>();
    data.expenses.forEach((e) => {
      const d = new Date(e.date);
      if (d.getFullYear() === monthInfo.year && (d.getMonth() + 1) === monthInfo.month) {
        map.set(e.date, (map.get(e.date) || 0) + parseFloat(e.amount || '0'));
      }
    });
    return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
  }, [data.expenses, monthInfo.year, monthInfo.month]);

  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    data.categories.forEach(c => map.set(c.id, c));
    return map;
  }, [data.categories]);

  const hasRecurringExpenseOnDate = (dateString: string) => {
    return data.recurring.some(recurring => {
      if (!recurring.isActive) return false;
      if (recurring.endDate && dateString > recurring.endDate) return false;
      if (dateString < recurring.startDate) return false;
      const startDate = new Date(recurring.startDate);
      const targetDate = new Date(dateString);
      switch (recurring.frequency) {
        case 'daily':
          return true;
        case 'weekly': {
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff % 7 === 0;
        }
        case 'monthly': {
          const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
          const dayOfMonth = startDate.getDate();
          return monthsDiff >= 0 && targetDate.getDate() === dayOfMonth;
        }
        case 'custom': {
          if (recurring.customDays) {
            const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff % recurring.customDays === 0;
          }
          return false;
        }
        default:
          return false;
      }
    });
  };

  const getRecurringItemsForDate = (dateString: string) => {
    return data.recurring.filter(recurring => {
      if (!recurring.isActive) return false;
      if (recurring.endDate && dateString > recurring.endDate) return false;
      if (dateString < recurring.startDate) return false;
      const startDate = new Date(recurring.startDate);
      const targetDate = new Date(dateString);
      switch (recurring.frequency) {
        case 'daily':
          return true;
        case 'weekly': {
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff % 7 === 0;
        }
        case 'monthly': {
          const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
          const dayOfMonth = startDate.getDate();
          return monthsDiff >= 0 && targetDate.getDate() === dayOfMonth;
        }
        case 'custom': {
          if (recurring.customDays) {
            const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff % recurring.customDays === 0;
          }
          return false;
        }
        default:
          return false;
      }
    });
  };

  const combinedPreviewItems = (
    previewDate
      ? [
          ...data.expenses.filter(e => e.date === previewDate).map(exp => ({
            key: exp.id,
            name: exp.name,
            amount: exp.amount,
            isRecurring: false,
          })),
          ...getRecurringItemsForDate(previewDate).map((item, idx) => ({
            key: `rec-${idx}-${item.name}-${item.amount}`,
            name: item.name,
            amount: item.amount,
            isRecurring: true,
          })),
        ]
      : []
  );

  const getTotalForDate = (dateString: string) => {
    const found = monthlyTotals.find(mt => mt.date === dateString);
    return found ? found.total : 0;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleExpenseClick = (expense: Expense) => {
    setSelectedExpense(expense);
    setCopyExpenseDialogOpen(true);
    setShowMoreOptions(false);
    setCustomDate(getToday());
  };

  const handleCopyExpense = async (useCustomDate = false) => {
    if (!selectedExpense) return;
    
    setCopyLoading(true);
    try {
      const targetDate = useCustomDate ? customDate : getToday();
      
      // Create a new expense with the specified date
      await createExpense({
        name: selectedExpense.name,
        amount: selectedExpense.amount,
        details: selectedExpense.details ?? undefined,
        categoryId: selectedExpense.categoryId ?? undefined,
        date: targetDate,
      });
      
      const dateDescription = useCustomDate ? 
        `your expenses for ${new Date(customDate).toLocaleDateString()}` : 
        "your today's expenses";
      
      toast({ 
        title: "Expense copied!", 
        description: `${selectedExpense.name} has been added to ${dateDescription}.` 
      });
      
      setCopyExpenseDialogOpen(false);
      setSelectedExpense(null);
      setShowMoreOptions(false);
      setCustomDate(getToday()); // Reset custom date
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to copy expense. Please try again." 
      });
    } finally {
      setCopyLoading(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-0">Monthly Calendar</h2>
            <div className="flex items-center justify-center sm:justify-start space-x-4">
              <Button variant="ghost" size="sm" onClick={previousMonth} className="p-2 text-muted-foreground hover:text-foreground">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium text-foreground">{monthInfo.monthName}</span>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="p-2 text-muted-foreground hover:text-foreground">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2 sm:py-3">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const total = getTotalForDate(day.dateString);
              const hasExpenses = total > 0;
              const hasRecurring = hasRecurringExpenseOnDate(day.dateString);
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!day.isCurrentMonth) {
                      setPreviewItems([]);
                      setPreviewDate(null);
                      return;
                    }
                    setPreviewDate(day.dateString);
                    const items = getRecurringItemsForDate(day.dateString).map(i => ({ name: i.name, amount: i.amount }));
                    setPreviewItems(items);
                  }}
                  className={`aspect-square p-1 sm:p-2 rounded-lg transition duration-200 ${
                    day.isToday
                      ? "bg-primary text-white"
                      : day.isCurrentMonth
                      ? "hover:bg-muted border-2 border-transparent hover:border-primary cursor-pointer"
                      : "text-muted-foreground hover:bg-muted"
                  } ${day.isCurrentMonth ? 'cursor-pointer' : ''}`}
                  title={day.isCurrentMonth ? `View details for ${day.dateString}` : ''}
                >
                  <div className={`text-xs sm:text-sm font-medium ${day.isToday ? "text-white" : "text-foreground"}`}>{day.date.getDate()}</div>
                  {day.isCurrentMonth && (
                    <>
                      {hasExpenses && (
                        <div className={`text-xs font-medium mt-1 ${day.isToday ? "text-white" : "text-foreground"}`}>{total === 0 ? "0" : Math.round(total)}</div>
                      )}
                      {hasRecurring && (
                        <div className="flex items-center justify-center mt-1">
                          <Repeat className="w-3 h-3 text-muted-foreground" aria-label="Recurring" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {previewDate && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              {[...data.expenses.filter(e => e.date === previewDate).map(exp => ({
                key: exp.id,
                name: exp.name,
                amount: exp.amount,
                isRecurring: false,
              })), ...previewItems.map((item, idx) => ({ key: `rec-${idx}-${item.name}-${item.amount}`, ...item, isRecurring: true }))].map((item) => (
                <div 
                  key={item.key} 
                  className={`flex items-center justify-between ${!item.isRecurring ? 'cursor-pointer hover:bg-muted/50 p-2 rounded transition-colors' : ''}`}
                  onClick={() => {
                    if (!item.isRecurring) {
                      // Find the actual expense object to pass to the handler
                      const expense = data.expenses.find(e => e.id === item.key);
                      if (expense) {
                        handleExpenseClick(expense);
                      }
                    }
                  }}
                >
                  <span className="text-sm text-foreground font-medium flex items-center gap-1">
                    {item.isRecurring && <Repeat className="w-3 h-3 text-muted-foreground" aria-label="Recurring" />}
                    {item.name}
                  </span>
                  <span className="text-sm text-foreground font-semibold">{CURRENCIES[currency].symbol}{formatAmountDisplay(parseFloat(item.amount || '0'))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Copy Expense Confirmation Dialog */}
      <Dialog open={copyExpenseDialogOpen} onOpenChange={setCopyExpenseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy Expense</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="p-3 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 rounded-full border" style={{ backgroundColor: (selectedExpense.categoryId && data.categories.find(c => c.id === selectedExpense.categoryId)?.color) || '#E5E7EB', borderColor: '#CBD5E1' }} />
                    <div>
                      <div className="font-medium">{selectedExpense.name}</div>
                      <div className="text-sm text-muted-foreground">{data.categories.find(c => c.id === selectedExpense.categoryId)?.name || 'Uncategorized'}</div>
                    </div>
                  </div>
                  <div className="font-semibold">{CURRENCIES[currency].symbol}{formatAmountDisplay(parseFloat(selectedExpense.amount || '0'))}</div>
                </div>
                {selectedExpense.details && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {selectedExpense.details}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="space-y-3">
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => handleCopyExpense(false)} 
                    disabled={copyLoading}
                    className="bg-rose-600 hover:bg-rose-700 w-full"
                  >
                    {copyLoading ? "Adding..." : "Add to Today's Expenses"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowMoreOptions(!showMoreOptions)}
                    className="w-full"
                  >
                    {showMoreOptions ? "Hide Options" : "More Options"}
                  </Button>
                </div>

                {/* More Options */}
                {showMoreOptions && (
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Choose a custom date:</label>
                      <DatePicker 
                        value={customDate} 
                        onChange={setCustomDate}
                        className="w-full"
                      />
                    </div>
                    <Button 
                      onClick={() => handleCopyExpense(true)} 
                      disabled={copyLoading}
                      className="bg-blue-600 hover:bg-blue-700 w-full"
                    >
                      {copyLoading ? "Adding..." : `Add to ${new Date(customDate).toLocaleDateString()}`}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyExpenseDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnerRecurringReadOnly({ currency, data }: { currency: CurrencyCode; data: { categories: Category[]; recurring: RecurringExpense[] } }) {
  const symbol = currency === 'INR' ? '₹' : '$';
  const categoryById = useMemo(() => {
    const map = new Map<string, Category>();
    data.categories.forEach(c => map.set(c.id, c));
    return map;
  }, [data.categories]);

  const items = data.recurring;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-lg font-semibold mb-4">Partner's Recurring Expenses</div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recurring items.</div>
        ) : (
          <div className="space-y-3">
            {items.map((r) => (
              <div key={r.id} className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{categoryById.get(r.categoryId || '')?.name || 'Uncategorized'} • {r.frequency}</div>
                </div>
                <div className="text-sm font-semibold">{symbol}{formatAmountDisplay(parseFloat(r.amount || '0'))}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
