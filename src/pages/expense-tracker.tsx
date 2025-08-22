import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, Users, Check, ChevronLeft, ChevronRight, Repeat, BarChart3, ArrowDown, ArrowUp, Plus, Edit, ChevronDown } from "lucide-react";
import { HiOutlineUserGroup } from "react-icons/hi2";
import { formatAmountDisplay } from "@/lib/utils";
 
import FollowupsTwoPeopleIcon from "@/components/icons/followups-two-people";
import FollowupsSeniorJuniorIcon from "@/components/icons/followups-senior-junior";
import FollowupsTwoPeopleCheckIcon from "@/components/icons/followups-two-people-check";
import FollowupsTwoPeopleSimpleIcon from "@/components/icons/followups-two-people-simple";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getToday, getMonthInfo, generateCalendarDays } from "@/lib/date-utils";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { getCategories, createExpense, getTripRecurringRaw, getTripExpensesRaw, setTripExpensesRaw } from "@/lib/localStorage";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { findVerifiedUserByEmail, createPartnerRequest, subscribeToIncomingRequests, subscribeToOutgoingRequests, updatePartnerRequestStatus, subscribeToAcceptedPartners, subscribeToUserDoc, type PartnerRequest } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import type { Category, Expense, RecurringExpense } from "@shared/schema";
import PartnerChat from "@/components/partner-chat";
import { type CurrencyCode, CURRENCIES } from "@/lib/currencies";
import TripInsights from "@/components/TripInsights";

type ViewType = "entry" | "charts" | "calendar" | "recurring" | "chat";

export default function ExpenseTracker() {
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [topTab, setTopTab] = useState<"my" | "couple" | "trips" | "followups">("my");
  const [tripsBlocked, setTripsBlocked] = useState<boolean>(() => {
    try { return localStorage.getItem('dailyspend_trips_conflict_pending') === 'true'; } catch { return false; }
  });
  const [expensesCurrency, setExpensesCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_expenses_currency") as CurrencyCode | null;
    return saved || "USD";
  });
  const [tripsCurrency, setTripsCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_trips_currency") as CurrencyCode | null;
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
  const tripsBlockedEffective = isVerified && tripsBlocked;
  const [dismissedIncomingPopup, setDismissedIncomingPopup] = useState<boolean>(false);
  const [ackRejectedIds, setAckRejectedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_ack_rejected_outgoing') || '[]'); } catch { return []; }
  });
  const [partnerUid, setPartnerUid] = useState<string | null>(null);
  const [partnerNameResolved, setPartnerNameResolved] = useState<string>("");
  const [acceptedPeerUid, setAcceptedPeerUid] = useState<string | null>(null);
  const [acceptedPeerName, setAcceptedPeerName] = useState<string>("");
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
  const [selectedCopyExpenseIds, setSelectedCopyExpenseIds] = useState<string[]>([]);
  const { toast } = useToast();

  // Trips: Add Trip dialog state
  const [addTripOpen, setAddTripOpen] = useState<boolean>(false);
  const [tripNameInput, setTripNameInput] = useState<string>("");
  const [selectedFriendsCount, setSelectedFriendsCount] = useState<number | null>(null);
  const [friendNames, setFriendNames] = useState<string[]>([]);
  const [hasTrips, setHasTrips] = useState<boolean>(() => {
    try { return (JSON.parse(localStorage.getItem('dailyspend_trips') || '[]') as any[]).length > 0; } catch { return false; }
  });
  const [tripsRevision, setTripsRevision] = useState<number>(0);

  const getStoredTrips = () => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]') as Array<{ id: string; name: string; friends: { name: string }[] }>; } catch { return []; }
  };
  const getNextDefaultTripName = () => {
    const trips = getStoredTrips();
    const taken = new Set(trips.map(t => t.name));
    let i = 1;
    while (taken.has(`Trip ${i}`)) i++;
    return `Trip ${i}`;
  };
  const resetAddTripState = () => {
    setTripNameInput("");
    setSelectedFriendsCount(null);
    setFriendNames([]);
  };
  const handleCreateTrip = async () => {
    const finalName = (tripNameInput.trim()) || getNextDefaultTripName();
    const count = selectedFriendsCount || 0;
    const finalFriends: { name: string }[] = Array.from({ length: count }, (_, idx) => ({
      name: (friendNames[idx] || "").trim() || `Friend ${idx + 1}`,
    }));
    const newTrip = { id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`, name: finalName, friends: finalFriends };
    const trips = getStoredTrips();
    trips.push(newTrip);
    try { localStorage.setItem('dailyspend_trips', JSON.stringify(trips)); } catch {}
    
    // Trigger immediate upload to Firebase
    try {
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
    
    toast({ title: 'Trip created', description: `${finalName} with ${count} friend${count === 1 ? '' : 's'}` });
    setHasTrips(true);
    setAddTripOpen(false);
    resetAddTripState();
  };

  useEffect(() => {
    if (topTab === 'trips') {
      setHasTrips(getStoredTrips().length > 0);
    }
  }, [topTab]);

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
          setSelectedCopyExpenseIds([]);
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
    // Reset selections whenever dialog opens/closes or source date changes
    if (!customCopyOpen) {
      setSelectedCopyExpenseIds([]);
      return;
    }
    setSelectedCopyExpenseIds([]);
  }, [customCopyOpen, copySourceDate]);

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
        setAcceptedPeerUid(null);
        setAcceptedPeerName("");
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
        setAcceptedPeerUid(userAcceptedRequest.fromUid);
        setAcceptedPeerName(userAcceptedRequest.fromName || userAcceptedRequest.fromEmail);
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
    if (v === 'trips' && tripsBlockedEffective) {
      // Prevent entering Trips until conflict is resolved; directly open the Trips conflict dialog
      setTopTab('my');
      try { window.dispatchEvent(new CustomEvent('dailyspend:open-trips-conflict')); } catch {}
      return;
    }
    // Reset bottom view to default when switching any top tab
    setCurrentView('entry');
    
    
    setTopTab(v as typeof topTab);
  };

  // Respond to global event to navigate home if trips conflict remains
  useEffect(() => {
    const onNavigateHome = () => {
      try { setTripsBlocked(localStorage.getItem('dailyspend_trips_conflict_pending') === 'true'); } catch {}
      setTopTab('my');
      setCurrentView('entry');
    };
    window.addEventListener('dailyspend:navigate-home', onNavigateHome);
    return () => window.removeEventListener('dailyspend:navigate-home', onNavigateHome);
  }, []);

  // Respond to global event to navigate to trips tab after conflict resolution
  useEffect(() => {
    const onNavigateTrips = () => {
      // Update trips blocked state before navigating
      try { setTripsBlocked(localStorage.getItem('dailyspend_trips_conflict_pending') === 'true'); } catch {}
      // Small delay to ensure localStorage update is processed
      setTimeout(() => {
        setTopTab('trips');
        setCurrentView('entry');
      }, 50);
    };
    window.addEventListener('dailyspend:navigate-trips', onNavigateTrips);
    return () => window.removeEventListener('dailyspend:navigate-trips', onNavigateTrips);
  }, []);

  // Always navigate to My Expenses Home on login
  useEffect(() => {
    if (user) {
      setTopTab('my');
      setCurrentView('entry');
    }
  }, [user?.uid]);

  // When trips conflict gets resolved elsewhere, unblock UI
  useEffect(() => {
    const onDataChanged = () => {
      try { setTripsBlocked(localStorage.getItem('dailyspend_trips_conflict_pending') === 'true'); } catch {}
    };
    const onTripsConflictResolved = () => {
      try { setTripsBlocked(false); } catch {}
    };
    window.addEventListener('dailyspend:data-changed', onDataChanged);
    window.addEventListener('dailyspend:trips-conflict-resolved', onTripsConflictResolved);
    return () => {
      window.removeEventListener('dailyspend:data-changed', onDataChanged);
      window.removeEventListener('dailyspend:trips-conflict-resolved', onTripsConflictResolved);
    };
  }, []);

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
    const shouldLock = topTab === 'couple' && !hasPartner && currentView !== 'chat';
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
  }, [topTab, hasPartner, currentView]);

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
                      currency={topTab === 'trips' ? tripsCurrency : expensesCurrency} 
                      setCurrency={topTab === 'trips' ? setTripsCurrency : setExpensesCurrency} 
                      topTab={topTab}
                      onPartnerRemoved={handlePartnerRemoved}
                      onTripsChanged={(hasAny) => { setHasTrips(hasAny); setTripsRevision((v) => v + 1); }}
                    />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-[calc(env(safe-area-inset-bottom)+7rem)]`}>
        {/* Top Tabs: below header, above content (edge-to-edge like bottom bar) */}
        <div ref={tabsContainerRef} className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-8 mb-4">
          <Tabs value={topTab} onValueChange={handleTopTabChange}>
            <TabsList className="w-full h-16 p-0 rounded-none bg-card border-b border text-gray-600">
              <TabsTrigger
                value="my"
                aria-label="My expenses"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <Wallet className="w-6 h-6 stroke-2" />
                <span className="sr-only">My expenses</span>
              </TabsTrigger>
              <TabsTrigger
                value="couple"
                aria-label="Couple expenses"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-rose-600 data-[state=active]:text-white data-[state=active]:shadow-none relative"
              >
                <div className="relative">
                  <Users className="w-6 h-6 stroke-2" />
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
                className={`flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-none ${tripsBlockedEffective ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <HiOutlineUserGroup className="w-6 h-6 stroke-[1.75]" />
                <span className="sr-only">My Trips</span>
              </TabsTrigger>
              <TabsTrigger
                value="followups"
                aria-label="Follow ups"
                className="flex-1 h-16 flex items-center justify-center rounded-none px-0 transition-all duration-200 hover:text-gray-900 hover:bg-gray-50 data-[state=active]:bg-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-none"
              >
                <div className="relative">
                  <FollowupsTwoPeopleSimpleIcon className="w-8 h-8 stroke-[1.4]" />
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
                currency={expensesCurrency}
                setCurrency={setExpensesCurrency}
                focusAmountTrigger={focusAmountTrigger}
                onFocusAmountConsumed={() => setFocusAmountTrigger(null)}
              />
            )}
            {currentView === "charts" && <ChartsView currency={expensesCurrency} />}
            {currentView === "calendar" && <CalendarView currency={expensesCurrency} />}
            {currentView === "recurring" && <RecurringExpenses currency={expensesCurrency} />}
          </>
        ) : topTab === 'couple' ? (
          <div className="relative">
            {/* If no accepted partner yet AND user hasn't accepted anyone, show placeholder content + overlay and CTA */}
            {(!hasPartner && !hasAcceptedRequest) || !isVerified ? (
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
                {(true) && (
                  <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />
                )}
                {/* CTA above blur (hidden during chat) */}
                {true && (
                <div className="fixed left-0 right-0 bottom-0 flex flex-col items-center justify-center gap-2 z-[80]" style={{ top: overlayTopPx }}>
                  <Button onClick={handleOpenAddPartner} size={isMobile ? 'default' : 'lg'} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Add a Partner
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
                )}

                {/* No chat button in this state; user hasn't accepted any request */}


              </>
            ) : null}

            {/* Partner read-only views when accepted */}
            {hasPartner && (
              <>
                {!partnerData ? (
                  <div className="p-4 text-sm text-muted-foreground">Loading {partnerNameResolved ? `${partnerNameResolved}'s` : 'partner'} data…</div>
                ) : (
                  <>
                    {currentView === 'entry' && (
                      <PartnerHomeReadOnly currency={expensesCurrency} data={partnerData} setCurrentPartnerDate={setCurrentPartnerDate} />
                    )}
                    {currentView === 'calendar' && (
                      <PartnerCalendarReadOnly currency={expensesCurrency} data={partnerData} />
                    )}
                    {currentView === 'recurring' && (
                      <PartnerRecurringReadOnly currency={expensesCurrency} data={partnerData} />
                    )}
                    {currentView === 'charts' && (
                      <div className="p-4 text-sm text-muted-foreground">Charts for partner will be available soon.</div>
                    )}
                    {currentView === 'chat' && (
                      <div className="p-4">
                        <PartnerChat peerUid={partnerUid} peerName={partnerNameResolved} />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Follower users (accepted someone else's request): show chat when selected; other content placeholders otherwise */}
            {!hasPartner && hasAcceptedRequest && isVerified && (
              <>
                {currentView !== 'chat' && (
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
                  </>
                )}
                {currentView === 'chat' && (
                  <div className="p-4">
                    <PartnerChat peerUid={acceptedPeerUid} peerName={acceptedPeerName} />
                  </div>
                )}

                {/* Blur overlay + Chat CTA for follower until they open chat */}
                {currentView !== 'chat' && (
                  <>
                    <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />
                    <div className="fixed bottom-0 right-0 z-[85] pb-[env(safe-area-inset-bottom)]">
                      <button
                        onClick={() => setCurrentView('chat')}
                        style={{ width: '25vw' }}
                        className="h-16 flex flex-col items-center justify-center transition-all duration-200 bg-rose-600 text-white"
                      >
                        <Users className="w-5 h-5 mb-1 text-white" />
                        <span className="text-xs font-medium text-white">Chat</span>
                      </button>
                    </div>
                    {/* Also show Add Partner/Friend CTA like in leader placeholder */}
                    <div className="fixed left-0 right-0 bottom-0 flex flex-col items-center justify-center gap-2 z-[80]" style={{ top: overlayTopPx }}>
                                        <Button onClick={handleOpenAddPartner} size={isMobile ? 'default' : 'lg'} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Add a Partner
                  </Button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ) : topTab === 'trips' ? (
          hasTrips ? (
            <>
                              {currentView === 'entry' && <TripHome currency={tripsCurrency} />}
                {currentView === 'calendar' && <TripCalendar currency={tripsCurrency} />}
                {currentView === 'recurring' && <TripRecurring currency={tripsCurrency} />}
              {currentView === 'charts' && <TripInsights currency={tripsCurrency} />}
            </>
          ) : tripsBlockedEffective ? (
            // Show conflict message when trips are blocked
            <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Data Synchronization Required</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  We found differences between your local trips and online trips. Please resolve the conflict to continue.
                </p>
              </div>
              <Button
                onClick={() => {
                  try { window.dispatchEvent(new CustomEvent('dailyspend:open-trips-conflict')); } catch {}
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Resolve Conflict
              </Button>
            </div>
          ) : (
          <div className="relative">
            {/* Placeholder scaffold (optional minimal content behind blur) */}
            <div className="space-y-4 sm:space-y-6 opacity-70 pointer-events-none select-none">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1">Trips</h2>
                      <p className="text-sm text-muted-foreground">Plan and track trip expenses</p>
                    </div>
                    <div className="h-8 w-24 rounded bg-emerald-600/20" />
                  </div>
                  {(() => {
                    const mockCategories = [
                      { id: 'food', name: 'Food', color: '#14B8A6' },    // teal-500
                      { id: 'travel', name: 'Travel', color: '#6366F1' }, // indigo-500
                      { id: 'groceries', name: 'Groceries', color: '#84CC16' }, // lime-500
                      { id: 'shopping', name: 'Shopping', color: '#D946EF' }, // fuchsia-500
                      { id: 'entertain', name: 'Entertainment', color: '#F97316' }, // orange-500
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-4">
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
                      <div className="h-40 rounded bg-muted" />
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-muted" />
                        <div className="h-4 w-24 rounded bg-muted" />
                        <div className="h-4 w-28 rounded bg-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {!hasTrips && (
              <>
                {/* Full-screen blur overlay below the tabs */}
                <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />

                {/* Centered CTA */}
                <div className="fixed left-0 right-0 bottom-0 z-[80] flex items-center justify-center" style={{ top: overlayTopPx }}>
                  <div className="flex flex-col items-center gap-3">
                    <Button
                      size={isMobile ? 'default' : 'lg'}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setAddTripOpen(true)}
                    >
                      Add a Trip
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
          )
        ) : topTab === 'followups' ? (
          <div className="relative">
            {/* Placeholder scaffold (optional minimal content behind blur) */}
            <div className="space-y-4 sm:space-y-6 opacity-70 pointer-events-none select-none">
              <Card>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1">Followups</h2>
                      <p className="text-sm text-muted-foreground">Monitor expenses of dependents and family members</p>
                    </div>
                    <div className="h-8 w-24 rounded bg-yellow-500/20" />
                  </div>
                  {(() => {
                    const mockCategories = [
                      { id: 'food', name: 'Food', color: '#EAB308' },    // yellow-500
                      { id: 'travel', name: 'Travel', color: '#F59E0B' }, // amber-500
                      { id: 'groceries', name: 'Groceries', color: '#FCD34D' }, // yellow-300
                      { id: 'shopping', name: 'Shopping', color: '#FBBF24' }, // amber-400
                      { id: 'entertain', name: 'Entertainment', color: '#FDE047' }, // yellow-200
                    ];
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-4">
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
                      <div className="h-40 rounded bg-muted" />
                    </CardContent>
                  </Card>
                </div>
                <div>
                  <Card>
                    <CardContent className="p-4 sm:p-6">
                      <div className="space-y-2">
                        <div className="h-4 w-32 rounded bg-muted" />
                        <div className="h-4 w-24 rounded bg-muted" />
                        <div className="h-4 w-28 rounded bg-muted" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>

            {/* Full-screen blur overlay below the tabs */}
            <div className="fixed left-0 right-0 bottom-0 z-[60] backdrop-blur-sm bg-background/30" style={{ top: overlayTopPx }} />

            {/* Centered CTA */}
            <div className="fixed left-0 right-0 bottom-0 z-[80] flex items-center justify-center" style={{ top: overlayTopPx }}>
              <div className="flex flex-col items-center gap-3">
                <Button
                  size={isMobile ? 'default' : 'lg'}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                  onClick={() => {/* TODO: Add user to follow */}}
                >
                  Add a User to Follow
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div />
        )}

        {/* Add Partner Dialog */}
        <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
          <DialogContent>
            <DialogHeader>
                              <DialogTitle>Add a Partner</DialogTitle>
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

      

      {/* Floating Action Button - Mobile only (hidden while in chat to avoid intercepting input) */}
      {currentView !== 'chat' && (
              <FloatingActionButton
        onClick={handleFabClick}
        colorVariant={topTab === 'couple' ? 'rose' : topTab === 'trips' ? 'emerald' : topTab === 'followups' ? 'yellow' : 'primary'}
        disabled={topTab === 'couple' && !hasPartner}
      />
      )}

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation
        currentView={hasAcceptedRequest && topTab === 'couple' && !hasPartner ? currentView : currentView}
        onViewChange={(v) => setCurrentView(v as ViewType)}
        colorVariant={topTab === 'couple' ? 'rose' : topTab === 'trips' ? 'emerald' : topTab === 'followups' ? 'yellow' : 'primary'}
        isCoupleTab={topTab === 'couple'}
        disabledIds={topTab === 'couple' && hasAcceptedRequest && !hasPartner ? ['entry','calendar','recurring'] : []}
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
                {(() => {
                  const sourceExpenses = (partnerData?.expenses || []).filter(e => e.date === copySourceDate);
                  const partnerRemaining = sourceExpenses.filter(e => !selectedCopyExpenseIds.includes(e.id));
                  const categoryById = new Map<string, Category>();
                  (partnerData?.categories || []).forEach(c => categoryById.set(c.id, c));
                  const symbol = CURRENCIES[expensesCurrency].symbol;
                  return (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">Partner Today</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{partnerRemaining.length} item(s)</span>
                          {partnerRemaining.length > 0 && (
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gradient-to-r from-rose-500 to-pink-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.35)] hover:shadow-[0_0_14px_rgba(244,63,94,0.55)] hover:from-rose-600 hover:to-pink-600 ring-1 ring-white/40 dark:ring-black/30 transition"
                              onClick={() => {
                                setSelectedCopyExpenseIds(prev => {
                                  const set = new Set(prev);
                                  partnerRemaining.forEach(e => set.add(e.id));
                                  return Array.from(set);
                                });
                              }}
                              title="Select all to copy down"
                            >
                              Copy all
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {partnerRemaining.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No expenses remaining on partner list.</div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {partnerRemaining.map(exp => {
                            const cat = categoryById.get(exp.categoryId || '');
                            const color = cat?.color || '#CBD5E1';
                            return (
                              <div
                                key={exp.id}
                                className="group flex items-center gap-2 p-2 rounded-md border border-border shadow-sm bg-card hover:bg-muted/50 transition-colors transition-transform hover:-translate-y-0.5"
                              >
                                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
                                <button
                                  className="shrink-0 grid place-items-center rounded-full bg-rose-500/90 hover:bg-rose-600 text-white w-7 h-7 shadow-sm ring-1 ring-white/50 dark:ring-black/30"
                                  aria-label="Select to copy down"
                                  onClick={() => setSelectedCopyExpenseIds(prev => prev.includes(exp.id) ? prev : [...prev, exp.id])}
                                  title="Move to My date"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate text-foreground">{exp.name}</div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {(cat?.name) || 'Uncategorized'}
                                  </div>
                                </div>
                                <div className="text-sm font-semibold text-foreground">{symbol}{formatAmountDisplay(parseFloat(exp.amount || '0'))}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
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
                {(() => {
                  const sourceExpenses = (partnerData?.expenses || []).filter(e => e.date === copySourceDate);
                  const mySelected = sourceExpenses.filter(e => selectedCopyExpenseIds.includes(e.id));
                  const categoryById = new Map<string, Category>();
                  (partnerData?.categories || []).forEach(c => categoryById.set(c.id, c));
                  const symbol = CURRENCIES[expensesCurrency].symbol;
                  const selectedTotal = mySelected.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
                  return (
                    <div className="mt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">Selected for My Date</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{mySelected.length} item(s){mySelected.length > 0 ? ` • ${symbol}${formatAmountDisplay(selectedTotal)}` : ''}</span>
                          {mySelected.length > 0 && (
                            <button
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.35)] hover:shadow-[0_0_14px_rgba(14,165,233,0.55)] hover:from-sky-600 hover:to-blue-600 ring-1 ring-white/40 dark:ring-black/30 transition"
                              onClick={() => setSelectedCopyExpenseIds([])}
                              title="Move all back to Partner list"
                            >
                              Move all back
                              <ArrowUp className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      {mySelected.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No selected expenses yet.</div>
                      ) : (
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {mySelected.map(exp => {
                            const cat = categoryById.get(exp.categoryId || '');
                            const color = cat?.color || '#CBD5E1';
                            return (
                              <div
                                key={exp.id}
                                className="group flex items-center gap-2 p-2 rounded-md border border-border shadow-sm bg-card hover:bg-muted/50 transition-colors transition-transform hover:-translate-y-0.5"
                              >
                                <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
                                <button
                                  className="shrink-0 grid place-items-center rounded-full bg-sky-500/90 hover:bg-sky-600 text-white w-7 h-7 shadow-sm ring-1 ring-white/50 dark:ring-black/30"
                                  aria-label="Send back up to partner list"
                                  onClick={() => setSelectedCopyExpenseIds(prev => prev.filter(id => id !== exp.id))}
                                  title="Move back to Partner"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate text-foreground">{exp.name}</div>
                                  <div className="text-[11px] text-muted-foreground truncate">{(cat?.name) || 'Uncategorized'}</div>
                                </div>
                                <div className="text-sm font-semibold text-foreground">{symbol}{formatAmountDisplay(parseFloat(exp.amount || '0'))}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
            
            
            
            
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomCopyOpen(false)}>Cancel</Button>
            <Button
              className="bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white shadow-md ring-1 ring-white/40 dark:ring-black/20"
              onClick={() => {
                try {
                  let items = (partnerData?.expenses || []).filter(e => e.date === copySourceDate);
                  if (selectedCopyExpenseIds.length > 0) {
                    items = items.filter(e => selectedCopyExpenseIds.includes(e.id));
                  }
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
                  toast({
                    title: 'Expenses copied!',
                    description: `Partner's expenses successfully copied to your ${new Date(copyDestDate).toLocaleDateString()} expenses.`,
                  });
                } finally {
                  setSelectedCopyExpenseIds([]);
                  setCustomCopyOpen(false);
                }
              }}
            >
              {selectedCopyExpenseIds.length > 0 ? `Copy selected (${selectedCopyExpenseIds.length})` : 'Copy expenses'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trips: Add Trip Dialog */}
      <Dialog open={addTripOpen} onOpenChange={(v) => { setAddTripOpen(v); if (!v) resetAddTripState(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Trip name</label>
              <Input
                value={tripNameInput}
                onChange={(e) => setTripNameInput(e.target.value)}
                placeholder={`e.g. ${getNextDefaultTripName()}`}
              />
              <p className="text-xs text-muted-foreground mt-1">Leave empty to use the next available default name.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Number of friends to add</label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={selectedFriendsCount === n ? 'default' : 'outline'}
                    className={selectedFriendsCount === n ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}
                    onClick={() => {
                      setSelectedFriendsCount(n);
                      setFriendNames((prev) => {
                        const next = Array.from({ length: n }, (_, idx) => prev[idx] || '');
                        return next;
                      });
                    }}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
            {selectedFriendsCount != null && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Friend names</label>
                {Array.from({ length: selectedFriendsCount }, (_, idx) => (
                  <Input
                    key={idx}
                    value={friendNames[idx] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFriendNames((prev) => {
                        const copy = [...prev];
                        copy[idx] = val;
                        return copy;
                      });
                    }}
                    placeholder={`Friend ${idx + 1}`}
                  />
                ))}
                <p className="text-xs text-muted-foreground">Leave any blank to auto-name as Friend 1, Friend 2, ...</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddTripOpen(false); resetAddTripState(); }}>Cancel</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleCreateTrip} disabled={selectedFriendsCount == null}>
              Create Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Trip = { id: string; name: string; friends: { name: string }[] };

function TripHome({ currency }: { currency: CurrencyCode }) {
  const [trips, setTrips] = useState<Trip[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]'); } catch { return []; }
  });
  const [activeTripId, setActiveTripId] = useState<string>(() => (trips[0]?.id || ''));
  const activeTrip = trips.find(t => t.id === activeTripId) || trips[0] || null;
  const [selectedFriendIndex, setSelectedFriendIndex] = useState<number>(0);
  const [date, setDate] = useState<string>(getToday());
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [details, setDetails] = useState<string>('');
  const [showAddDetails, setShowAddDetails] = useState<boolean>(false);
  const { toast } = useToast();
  const [tripDataRev, setTripDataRev] = useState<number>(0);

  // Edit dialog state for trip expenses (parity with My expenses)
  const [editing, setEditing] = useState<TripExpense | null>(null);
  const [editTripFields, setEditTripFields] = useState<{ name: string; amount: string; details: string; friendIndex: number } | null>(null);
  const [showEditTripDetails, setShowEditTripDetails] = useState(false);

  const symbol = CURRENCIES[currency].symbol;

  // Storage helpers for trip expenses
  type TripExpense = { id: string; tripId: string; friendIndex: number; name: string; amount: string; details?: string | null; date: string; createdAt: string };
  const getTripExpenses = (): TripExpense[] => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trip_expenses') || '[]'); } catch { return []; }
  };
  const setTripExpenses = (items: TripExpense[]) => {
    try { setTripExpensesRaw(items as any); } catch { try { localStorage.setItem('dailyspend_trip_expenses', JSON.stringify(items)); } catch {} }
  };

  useEffect(() => {
    // Refresh trips when storage may have changed (renames, add/remove)
    try { setTrips(JSON.parse(localStorage.getItem('dailyspend_trips') || '[]')); } catch {}
  }, [localStorage.getItem('dailyspend_trips')]);

  useEffect(() => {
    if (!activeTrip && trips[0]) setActiveTripId(trips[0].id);
  }, [trips, activeTrip]);

  const expensesForDate = useMemo(() => {
    const all = getTripExpenses();
    if (!activeTrip) return [] as TripExpense[];
    return all.filter(e => e.tripId === activeTrip.id && e.date === date);
  }, [activeTrip?.id, date, tripDataRev]);

  // Force refresh on global data change events (e.g., sync merges)
  useEffect(() => {
    const onChanged = () => {
      // Increment revision to force recompute
      setTripDataRev((v) => v + 1);
    };
    window.addEventListener('dailyspend:data-changed', onChanged);
    return () => window.removeEventListener('dailyspend:data-changed', onChanged);
  }, []);

  const totalForDate = useMemo(() => expensesForDate.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0), [expensesForDate]);

  const friendTotalsForDate = useMemo(() => {
    const all = getTripExpenses();
    const totals = new Map<number, number>();
    if (!activeTrip) return totals;
    all.forEach(e => {
      if (e.tripId === activeTrip.id && e.date === date) {
        const prev = totals.get(e.friendIndex) || 0;
        totals.set(e.friendIndex, prev + parseFloat(e.amount || '0'));
      }
    });
    return totals;
  }, [activeTrip?.id, date, tripDataRev]);

  const FRIEND_COLORS = [
    '#14B8A6', // teal
    '#6366F1', // indigo
    '#84CC16', // lime
    '#D946EF', // fuchsia
    '#F97316', // orange
  ];

  const handleAddExpense = async () => {
    if (!activeTrip) {
      toast({ title: 'No active trip', description: 'Please create a trip first or resolve any data conflicts', variant: 'destructive' });
      return;
    }
    
    // Additional safeguard: check if there are any local trips
    const localTrips = JSON.parse(localStorage.getItem('dailyspend_trips') || '[]');
    if (localTrips.length === 0) {
      toast({ title: 'No local trips', description: 'Please create a trip first or resolve any data conflicts', variant: 'destructive' });
      return;
    }
    
    const trimmedName = name.trim();
    const trimmedAmount = amount.trim();
    if (!trimmedName || !trimmedAmount || isNaN(Number(trimmedAmount))) {
      toast({ title: 'Enter valid name and amount', variant: 'destructive' });
      return;
    }
    const newItem: TripExpense = {
      id: `${Date.now()}-${Math.floor(Math.random()*1e6)}`,
      tripId: activeTrip.id,
      friendIndex: selectedFriendIndex,
      name: trimmedName,
      amount: trimmedAmount,
      details: details.trim() || undefined,
      date,
      createdAt: new Date().toISOString(),
    };
    const all = getTripExpenses();
    all.push(newItem);
    setTripExpenses(all);
    
    // Trigger immediate upload to Firebase
    try {
      // Dispatch a custom event to trigger immediate sync
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
    
    setName(''); setAmount(''); setDetails('');
    toast({ title: 'Added', description: `${trimmedName} added for ${activeTrip.friends[selectedFriendIndex]?.name || 'Friend ' + (selectedFriendIndex+1)}` });
  };

  const openTripEdit = (expense: TripExpense) => {
    setEditing(expense);
    setEditTripFields({
      name: expense.name,
      amount: expense.amount,
      details: expense.details || '',
      friendIndex: expense.friendIndex,
    });
    setShowEditTripDetails(!!expense.details);
  };

  const closeTripEdit = () => {
    setEditing(null);
    setEditTripFields(null);
    setShowEditTripDetails(false);
  };

  const saveTripExpense = async () => {
    if (!editing || !editTripFields) return;
    const amountNum = parseFloat(editTripFields.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ title: 'Error', description: 'Please enter a valid amount', variant: 'destructive' });
      return;
    }
    const all = getTripExpenses();
    const next = all.map((e) => e.id === editing.id ? {
      ...e,
      name: editTripFields.name,
      amount: amountNum.toString(),
      details: editTripFields.details.trim() === '' ? undefined : editTripFields.details,
      friendIndex: editTripFields.friendIndex,
    } : e);
    setTripExpenses(next);
    setTripDataRev((v) => v + 1);
    
    // Trigger immediate upload to Firebase
    try {
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
    
    toast({ title: 'Success', description: 'Expense updated successfully' });
    closeTripEdit();
  };

  const deleteTripExpense = async () => {
    if (!editing) return;
    const all = getTripExpenses();
    const next = all.filter((e) => e.id !== editing.id);
    setTripExpenses(next);
    setTripDataRev((v) => v + 1);
    
    // Trigger immediate upload to Firebase
    try {
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
    
    toast({ title: 'Deleted', description: 'Expense deleted successfully' });
    closeTripEdit();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            <div className="min-w-0">
              {trips.length > 1 ? (
                <Select value={activeTrip?.id || ''} onValueChange={(value) => setActiveTripId(value)}>
                  <SelectTrigger className="h-auto p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                    <SelectValue>
                      <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 cursor-pointer hover:text-foreground/60 transition-colors flex items-center">
                        <span className="text-emerald-600 dark:text-emerald-400 mr-2">✈️</span>
                        {activeTrip ? activeTrip.name : 'Trips'}
                        <ChevronDown className="inline-block w-4 h-4 ml-2 text-muted-foreground" />
                      </h2>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {trips.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 flex items-center">
                  <span className="text-emerald-600 dark:text-emerald-400 mr-2">✈️</span>
                  {activeTrip ? activeTrip.name : 'Trips'}
                </h2>
              )}
              <div className="flex items-center gap-2">
                <DatePicker value={date} onChange={(v: string) => setDate(v)} className="h-8 text-sm" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
            </div>
          </div>
          {activeTrip && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mt-4">
              {activeTrip.friends.map((f, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFriendIndex(idx)}
                  className={`border rounded-lg p-2 sm:p-3 text-center transition ${idx === selectedFriendIndex ? 'ring-2 ring-emerald-500' : ''}`}
                  style={{ backgroundColor: `${FRIEND_COLORS[idx % FRIEND_COLORS.length]}10`, borderColor: `${FRIEND_COLORS[idx % FRIEND_COLORS.length]}40` }}
                >
                  <div className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto mb-1 sm:mb-2" style={{ backgroundColor: FRIEND_COLORS[idx % FRIEND_COLORS.length] }} />
                  <div className="text-xs font-medium text-muted-foreground truncate">{f.name || `Friend ${idx+1}`}</div>
                  <div className="text-xs font-semibold text-foreground mt-1">{symbol}{formatAmountDisplay(friendTotalsForDate.get(idx) || 0)}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Expense */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center">
            <span className="text-emerald-600 dark:text-emerald-400 mr-2">+</span>
            Add New Expense
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Amount ({symbol})</label>
                <Input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Expense Name</label>
                <Input placeholder="e.g., Lunch at cafe" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Friend</label>
              <div className="mt-2">
                <Select value={String(selectedFriendIndex)} onValueChange={(v) => setSelectedFriendIndex(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a friend" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {(activeTrip?.friends || []).map((f, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: FRIEND_COLORS[idx % FRIEND_COLORS.length] }} />
                          {f.name || `Friend ${idx+1}`}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowAddDetails(!showAddDetails)}
                className="w-full justify-start text-gray-600 hover:text-gray-900 p-0 h-auto font-normal"
              >
                <span className="text-sm">Additional Details (Optional)</span>
              </Button>
              {showAddDetails && (
                <Textarea
                  placeholder="Add any additional notes about this expense..."
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="transition-all duration-200 ease-in-out"
                />
              )}
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 transition duration-200" onClick={handleAddExpense}>
              Add Expense
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Today's Expenses */}
      <Card className="overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <div className="p-4 sm:p-6 border-b border-emerald-200 dark:border-emerald-700 bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <span className="text-emerald-600 dark:text-emerald-400 mr-2">📋</span>
            Expense List
          </h3>
          <p className="text-xs mt-1">
            <span className="text-muted-foreground mr-1">{new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">{new Date(date).toLocaleDateString('en-US', { weekday: 'short' })}</span>
          </p>
        </div>
        <CardContent className="p-4 sm:p-6">
          {expensesForDate.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-6xl mb-4">✈️</div>
              <p className="text-lg font-medium mb-2">No trip expenses yet</p>
              <p className="text-sm">Start by adding your first trip expense above to track your group spending.</p>
            </div>
          ) : (
            <div>
              {expensesForDate.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 cursor-pointer transition-all duration-200 hover:shadow-md rounded-lg border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800" onClick={() => openTripEdit(e)}>
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className="w-4 h-4 rounded-full flex-shrink-0 border-2 shadow-md" style={{ 
                      backgroundColor: FRIEND_COLORS[e.friendIndex % FRIEND_COLORS.length], 
                      borderColor: (FRIEND_COLORS[e.friendIndex % FRIEND_COLORS.length]) + '60',
                      boxShadow: `0 0 0 3px ${(FRIEND_COLORS[e.friendIndex % FRIEND_COLORS.length])}20, 0 2px 4px rgba(0,0,0,0.1)`
                    }} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{e.name}</p>
                      {e.details && (
                        <p className="text-xs sm:text-sm text-muted-foreground whitespace-normal break-words">{e.details}</p>
                      )}
                      <p className="text-[11px] sm:text-xs text-muted-foreground">{activeTrip?.friends[e.friendIndex]?.name || `Friend ${e.friendIndex+1}`} • {new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3 sm:ml-4">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300 text-sm sm:text-base bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 rounded-full">
                      {symbol}{formatAmountDisplay(parseFloat(e.amount || '0'))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Trip Expense Dialog (parity with My expenses) */}
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) closeTripEdit(); }}>
        <DialogContent className="sm:max-w-md -mt-16 sm:mt-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700 z-[100]">
          <DialogHeader>
            <DialogTitle className="text-emerald-800 dark:text-emerald-200">Edit Trip Expense</DialogTitle>
          </DialogHeader>
          {editTripFields && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Amount ({symbol})</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={editTripFields.amount} 
                    onChange={(e) => setEditTripFields({ ...editTripFields, amount: e.target.value })}
                    className="border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Expense Name</label>
                  <Input 
                    value={editTripFields.name} 
                    onChange={(e) => setEditTripFields({ ...editTripFields, name: e.target.value })}
                    className="border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Friend</label>
                <Select 
                  value={String(editTripFields.friendIndex)} 
                  onValueChange={(v) => {
                    const newFriendIndex = parseInt(v);
                    if (!isNaN(newFriendIndex)) {
                      setEditTripFields({ ...editTripFields, friendIndex: newFriendIndex });
                    }
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                    <SelectValue placeholder="Select a friend" />
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {(activeTrip?.friends || []).map((f, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: FRIEND_COLORS[idx % FRIEND_COLORS.length] }} />
                          {f.name || `Friend ${idx+1}`}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!activeTrip?.friends?.length && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">No friends available for this trip</p>
                )}
              </div>
              <div className="space-y-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setShowEditTripDetails(!showEditTripDetails)} 
                  className="w-full justify-start text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 p-0 h-auto font-normal"
                >
                  <span className="text-sm">Additional Details</span>
                </Button>
                {showEditTripDetails && (
                  <Textarea 
                    rows={3} 
                    value={editTripFields.details} 
                    onChange={(e) => setEditTripFields({ ...editTripFields, details: e.target.value })} 
                    className="transition-all duration-200 ease-in-out border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800"
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-row justify-end gap-2 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={deleteTripExpense}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white shadow-sm"
            >
              Delete
            </Button>
            <Button 
              size="sm" 
              onClick={saveTripExpense} 
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-sm"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TripRecurring({ currency }: { currency: CurrencyCode }) {
  const [trips, setTrips] = useState<Trip[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]'); } catch { return []; }
  });
  const [activeTripId, setActiveTripId] = useState<string>(() => (trips[0]?.id || ''));
  const activeTrip = trips.find(t => t.id === activeTripId) || null;
  const [recurring, setRecurring] = useState<Array<{ id: string; tripId: string; name: string; amount: string; details?: string; friendIndex: number; frequency: 'daily'|'weekly'|'monthly'|'custom'; customDays?: number; startDate: string; endDate?: string | null; isActive: boolean }>>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trip_recurring') || '[]'); } catch { return []; }
  });
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; amount: string; details: string; friendIndex: number; frequency: 'daily'|'weekly'|'monthly'|'custom'; customDays?: number; startDate: string; endDate: string }>({
    name: '', amount: '', details: '', friendIndex: 0, frequency: 'monthly', customDays: undefined, startDate: getToday(), endDate: ''
  });
  const { toast } = useToast();


  const symbol = CURRENCIES[currency].symbol;

  useEffect(() => {
    try { setTrips(JSON.parse(localStorage.getItem('dailyspend_trips') || '[]')); } catch {}
  }, []);

  const persist = (items: typeof recurring) => {
    try { localStorage.setItem('dailyspend_trip_recurring', JSON.stringify(items)); } catch {}
    setRecurring(items);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTrip) {
      toast({ title: 'No active trip', description: 'Please create a trip first or resolve any data conflicts', variant: 'destructive' });
      return;
    }
    
    // Additional safeguard: check if there are any local trips
    const localTrips = JSON.parse(localStorage.getItem('dailyspend_trips') || '[]');
    if (localTrips.length === 0) {
      toast({ title: 'No local trips', description: 'Please create a trip first or resolve any data conflicts', variant: 'destructive' });
      return;
    }
    if (!form.name || !form.amount || !form.startDate) {
      toast({ title: 'Validation Error', description: 'Fill required fields', variant: 'destructive' });
      return;
    }
    const today = getToday();
    if (form.startDate < today) {
      toast({ title: 'Validation Error', description: 'Start date cannot be in the past.', variant: 'destructive' });
      return;
    }
    if (form.frequency === 'custom' && !form.customDays) {
      toast({ title: 'Validation Error', description: 'Specify custom days.', variant: 'destructive' });
      return;
    }
    if (editingId) {
      const next = recurring.map(r => r.id === editingId ? {
        ...r,
        name: form.name,
        amount: form.amount,
        details: form.details || undefined,
        friendIndex: form.friendIndex,
        frequency: form.frequency,
        customDays: form.customDays,
        startDate: form.startDate,
        endDate: form.endDate || null,
      } : r);
      persist(next);
      
      // Trigger immediate upload to Firebase
      try {
        window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
      } catch (error) {
        console.error('Failed to trigger immediate upload:', error);
      }
      
      toast({ title: 'Updated' });
    } else {
      const item = {
        id: `${Date.now()}-${Math.floor(Math.random()*1e6)}`,
        tripId: activeTrip.id,
        name: form.name,
        amount: form.amount,
        details: form.details || undefined,
        friendIndex: form.friendIndex,
        frequency: form.frequency,
        customDays: form.customDays,
        startDate: form.startDate,
        endDate: form.endDate || null,
        isActive: true,
      } as typeof recurring[number];
      persist([...recurring, item]);
      
      // Trigger immediate upload to Firebase
      try {
        window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
      } catch (error) {
        console.error('Failed to trigger immediate upload:', error);
      }
      
      toast({ title: 'Added recurring' });
      // Immediate add if startDate is today
      if (form.startDate === getToday()) {
        try {
          const key = 'dailyspend_trip_expenses';
          const current: any[] = JSON.parse(localStorage.getItem(key) || '[]');
          current.push({
            id: `${Date.now()}-${Math.floor(Math.random()*1e6)}`,
            tripId: activeTrip.id,
            friendIndex: form.friendIndex,
            name: form.name,
            amount: form.amount,
            details: form.details || null,
            categoryId: null,
            date: getToday(),
            createdAt: new Date().toISOString(),
          });
          localStorage.setItem(key, JSON.stringify(current));
        } catch {}
      }
    }
    setEditingId(null);
    setIsAdding(false);
    setForm({ name: '', amount: '', details: '', friendIndex: 0, frequency: 'monthly', customDays: undefined, startDate: getToday(), endDate: '' });
  };

  const handleToggle = async (id: string) => {
    const next = recurring.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r);
    persist(next);
    
    // Trigger immediate upload to Firebase
    try {
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
  };
  const handleDelete = async (id: string) => {
    const next = recurring.filter(r => r.id !== id);
    persist(next);
    
    // Trigger immediate upload to Firebase
    try {
      window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
    } catch (error) {
      console.error('Failed to trigger immediate upload:', error);
    }
    
    toast({ title: 'Deleted' });
  };
  const handleEdit = (r: typeof recurring[number]) => {
    setEditingId(r.id);
    setIsAdding(true);
    setForm({
      name: r.name,
      amount: r.amount,
      details: r.details || '',
      friendIndex: r.friendIndex,
      frequency: r.frequency,
      customDays: r.customDays,
      startDate: r.startDate,
      endDate: r.endDate || '',
    });
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              {trips.length > 1 ? (
                <Select value={activeTripId} onValueChange={(value) => setActiveTripId(value)}>
                  <SelectTrigger className="h-auto p-0 border-none bg-transparent hover:bg-transparent focus:ring-0 focus:ring-offset-0 [&>svg]:hidden">
                    <SelectValue>
                      <h2 className="text-2xl font-bold text-foreground cursor-pointer hover:text-foreground/80 transition-colors flex items-center">
                        <span className="text-emerald-600 dark:text-emerald-400 mr-2">🔄</span>
                        Recurring Expenses
                        <ChevronDown className="inline-block w-4 h-4 ml-2 text-muted-foreground" />
                      </h2>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="z-[9999]">
                    {trips.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <h2 className="text-2xl font-bold text-foreground flex items-center">
                  <span className="text-emerald-600 dark:text-emerald-400 mr-2">🔄</span>
                  Recurring Expenses
                </h2>
              )}
              <p className="text-muted-foreground">Manage your recurring expenses and subscriptions</p>
            </div>
            <Button
              onClick={() => setIsAdding(true)}
              aria-label="Add Recurring"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-200 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base min-w-0"
            >
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdding && (
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Hotel" />
                </div>
                <div>
                  <Label>Amount *</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0.00" />
                </div>
              </div>
              <div>
                <Label>Details</Label>
                <Input value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Friend</Label>
                  <Select value={String(form.friendIndex)} onValueChange={(v) => setForm({ ...form, friendIndex: parseInt(v) })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select friend" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      {(activeTrip?.friends || []).map((f, idx) => (
                        <SelectItem key={idx} value={String(idx)}>
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: ['#14B8A6','#6366F1','#84CC16','#D946EF','#F97316'][idx % 5] }} />
                            {f.name || `Friend ${idx+1}`}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Frequency *</Label>
                  <Select value={form.frequency} onValueChange={(v: any) => setForm({ ...form, frequency: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {form.frequency === 'custom' && (
                <div>
                  <Label>Every X Days *</Label>
                  <Input type="number" min="1" value={form.customDays || ''} onChange={(e) => setForm({ ...form, customDays: parseInt(e.target.value) || undefined })} placeholder="e.g., 14" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Start Date *</Label>
                  <Input type="date" value={form.startDate} min={getToday()} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <Label>End Date (Optional)</Label>
                  <Input type="date" value={form.endDate} min={form.startDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">{editingId ? 'Update' : 'Create'}</Button>
                {editingId && <Button type="button" variant="destructive" onClick={() => { if (editingId) { setPendingDeleteId(editingId); setShowDeleteDialog(true); } }}>Delete</Button>}
                <Button type="button" variant="outline" onClick={() => { setIsAdding(false); setEditingId(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Expense</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the recurring expense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setPendingDeleteId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) {
                  handleDelete(pendingDeleteId);
                  setIsAdding(false);
                  setEditingId(null);
                }
                setShowDeleteDialog(false);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground flex items-center">
              <span className="text-emerald-600 dark:text-emerald-400 mr-2">📋</span>
              Active Recurring Expenses
            </h3>
            {recurring.filter(r => r.tripId === activeTripId).length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <div className="text-6xl mb-4">🔄</div>
                <p className="text-lg font-medium mb-2">No Recurring Expenses</p>
                <p className="text-sm">Create your first recurring expense to get started.</p>
              </div>
                    ) : (
              <div className="grid gap-4">
                {recurring.filter(r => r.tripId === activeTripId).map((r) => (
                  <Card key={r.id} className="bg-gradient-to-br from-white to-emerald-50/50 dark:from-gray-900 dark:to-emerald-950/10 border-emerald-200 dark:border-emerald-800 hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{r.name}</h4>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground min-w-0">
                            <span className="font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-full text-xs">
                              {symbol}{r.amount}
                            </span>
                            <span className="flex items-center">
                              <div className="w-4 h-4 rounded-full mr-2 border-2 shadow-sm" style={{ 
                                backgroundColor: ['#14B8A6','#6366F1','#84CC16','#D946EF','#F97316'][r.friendIndex % 5],
                                borderColor: ['#14B8A6','#6366F1','#84CC16','#D946EF','#F97316'][r.friendIndex % 5] + '60',
                                boxShadow: `0 0 0 2px ${['#14B8A6','#6366F1','#84CC16','#D946EF','#F97316'][r.friendIndex % 5]}20`
                              }} />
                              {(activeTrip?.friends[r.friendIndex]?.name) || `Friend ${r.friendIndex+1}`}
                            </span>
                          </div>
                          {r.details && <p className="text-sm text-muted-foreground mt-2 break-words">{r.details}</p>}
                          <div className="mt-3 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant={r.isActive ? 'default' : 'secondary'} className={r.isActive ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                                {r.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-700 dark:text-emerald-300">
                                {r.frequency === 'custom' ? `Every ${r.customDays} days` : r.frequency[0].toUpperCase()+r.frequency.slice(1)}
                              </Badge>
                            </div>
                            {r.endDate && (
                              <div className="text-sm text-muted-foreground">Ends: {r.endDate}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-4 shrink-0">
                          <Switch checked={r.isActive} onCheckedChange={() => handleToggle(r.id)} />
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(r)} className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/30">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TripCalendar({ currency }: { currency: CurrencyCode }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthInfo = getMonthInfo(currentDate);
  const calendarDays = generateCalendarDays(monthInfo.year, monthInfo.month - 1);
  const [trips] = useState<Trip[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]'); } catch { return []; }
  });
  const activeTripId = trips[0]?.id || '';
  const [previewDate, setPreviewDate] = useState<string | null>(getToday());
  const [previewItems, setPreviewItems] = useState<Array<{ key: string; name: string; amount: string; isRecurring: boolean }>>([]);

  type TripExpense = { id: string; tripId: string; friendIndex: number; name: string; amount: string; details?: string | null; date: string; createdAt: string };
  const getTripExpenses = (): TripExpense[] => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trip_expenses') || '[]'); } catch { return []; }
  };
  const getTripRecurring = () => getTripRecurringRaw();

  const symbol = CURRENCIES[currency].symbol;

  const monthlyTotals = useMemo(() => {
    const all = getTripExpenses();
    const map = new Map<string, number>();
    all.forEach(e => {
      if (e.tripId !== activeTripId) return;
      const d = new Date(e.date);
      if (d.getFullYear() === monthInfo.year && (d.getMonth() + 1) === monthInfo.month) {
        map.set(e.date, (map.get(e.date) || 0) + parseFloat(e.amount || '0'));
      }
    });
    return Array.from(map.entries()).map(([date, total]) => ({ date, total }));
  }, [currentDate, activeTripId]);

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

  const hasRecurringExpenseOnDate = (dateString: string) => {
    return getTripRecurring().some(r => {
      if (!r.isActive) return false;
      if (r.endDate && dateString > r.endDate) return false;
      if (dateString < r.startDate) return false;
      const startDate = new Date(r.startDate);
      const targetDate = new Date(dateString);
      switch (r.frequency) {
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
          if (r.customDays) {
            const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff % r.customDays === 0;
          }
          return false;
        }
        default:
          return false;
      }
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-0 flex items-center">
              <span className="text-emerald-600 dark:text-emerald-400 mr-2">📅</span>
              Monthly Calendar
            </h2>
            <div className="flex items-center justify-center sm:justify-start space-x-4">
              <Button variant="ghost" size="sm" onClick={previousMonth} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium text-emerald-700 dark:text-emerald-300">{monthInfo.monthName}</span>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="p-2 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-emerald-700 dark:text-emerald-300 py-2 sm:py-3">{day}</div>
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
                    const items = getTripRecurring().filter(r => r.isActive && (!r.endDate || day.dateString <= r.endDate) && day.dateString >= r.startDate)
                      .map((r, idx) => ({ key: `rec-${idx}-${r.name}-${r.amount}`, name: r.name, amount: r.amount, isRecurring: true }));
                    setPreviewItems(items);
                  }}
                  className={`aspect-square p-1 sm:p-2 rounded-lg transition-all duration-200 ${
                    day.isToday
                      ? "bg-emerald-600 text-white shadow-lg"
                      : day.isCurrentMonth
                      ? "hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border-2 border-transparent hover:border-emerald-400 cursor-pointer hover:shadow-md"
                      : "text-muted-foreground hover:bg-muted"
                  } ${day.isCurrentMonth ? 'cursor-pointer' : ''}`}
                >
                  <div className={`text-xs sm:text-sm font-medium ${day.isToday ? "text-white" : "text-foreground"}`}>{day.date.getDate()}</div>
                  {day.isCurrentMonth && (
                    <>
                      {hasExpenses && (
                        <div className={`text-xs font-medium mt-1 ${day.isToday ? "text-white" : "text-foreground"}`}>{total === 0 ? "0" : Math.round(total)}</div>
                      )}
                      {hasRecurring && (
                        <div className="flex items-center justify-center mt-1">
                          <Repeat className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-label="Recurring" />
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
        <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              {[...getTripExpenses().filter(e => e.tripId === activeTripId && e.date === previewDate).map(exp => ({
                key: exp.id,
                name: exp.name,
                amount: exp.amount,
                isRecurring: false,
              })), ...previewItems].map((item) => (
                <div key={item.key} className={`flex items-center justify-between ${!item.isRecurring ? 'p-2 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-all duration-200 hover:shadow-sm' : ''}`}>
                  <span className="text-sm text-foreground font-medium flex items-center gap-1">
                    {item.isRecurring && <Repeat className="w-3 h-3 text-emerald-600 dark:text-emerald-400" aria-label="Recurring" />}
                    {item.name}
                  </span>
                  <span className="text-sm text-foreground font-semibold">{symbol}{formatAmountDisplay(parseFloat(item.amount || '0'))}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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
      <Card className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground/80 mb-1 flex items-center">
                <span className="text-rose-600 dark:text-rose-400 mr-2">👥</span>
                {selectedDate === getToday() ? "Partner's Today's Expenses" : "Partner's Expenses"}
              </h2>
              <div className="flex items-center gap-2">
                <DatePicker value={selectedDate} onChange={(v: string) => setSelectedDate(v)} className="h-8 text-sm" />
                <span className="text-sm font-medium text-rose-600 dark:text-rose-400">{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'short' })}</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs sm:text-sm font-medium text-muted-foreground">{selectedDate === getToday() ? "Today" : "Selected Date"}</p>
              <p className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400">{symbol}{formatAmountDisplay(totalForDate)}</p>
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

      <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-700">
        <div className="p-4 sm:p-6 border-b border-rose-200 dark:border-rose-700 bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30">
          <h3 className="text-lg font-semibold text-foreground/80 flex items-center">
            <span className="text-rose-600 dark:text-rose-400 mr-2">📋</span>
            Partner's Expenses
          </h3>
        </div>
        <CardContent className="p-0">
          {expensesForDate.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No expenses for the selected date.</div>
          ) : (
            <div className="divide-y">
              {expensesForDate.map((exp) => (
                <div 
                  key={exp.id} 
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-200 hover:shadow-sm rounded-lg"
                  onClick={() => handleExpenseClick(exp)}
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div className="w-3 h-3 rounded-full flex-shrink-0 border-2 shadow-sm" style={{ 
                      backgroundColor: (exp.categoryId && categoryById.get(exp.categoryId)?.color) || '#E5E7EB', 
                      borderColor: (exp.categoryId && categoryById.get(exp.categoryId)?.color) || '#E5E7EB' + '40',
                      boxShadow: `0 0 0 2px ${(exp.categoryId && categoryById.get(exp.categoryId)?.color) || '#E5E7EB'}20`
                    }} />
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
  const [previewDate, setPreviewDate] = useState<string | null>(getToday());
  const [copyExpenseDialogOpen, setCopyExpenseDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [copyLoading, setCopyLoading] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [customDate, setCustomDate] = useState(getToday());
  const { toast } = useToast();
  const monthInfo = getMonthInfo(currentDate);
  const calendarDays = generateCalendarDays(monthInfo.year, monthInfo.month - 1);



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

  // Show today's preview by default
  useEffect(() => {
    if (!previewDate) return;
    const items = getRecurringItemsForDate(previewDate).map(i => ({ name: i.name, amount: i.amount }));
    setPreviewItems(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      <Card className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-0 flex items-center">
              <span className="text-rose-600 dark:text-rose-400 mr-2">📅</span>
              Monthly Calendar
            </h2>
            <div className="flex items-center justify-center sm:justify-start space-x-4">
              <Button variant="ghost" size="sm" onClick={previousMonth} className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium text-rose-700 dark:text-rose-300">{monthInfo.monthName}</span>
              <Button variant="ghost" size="sm" onClick={nextMonth} className="p-2 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-rose-700 dark:text-rose-300 py-2 sm:py-3">{day}</div>
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
                  className={`aspect-square p-1 sm:p-2 rounded-lg transition-all duration-200 ${
                    day.isToday
                      ? "bg-rose-600 text-white shadow-lg"
                      : day.isCurrentMonth
                      ? "hover:bg-rose-100 dark:hover:bg-rose-900/30 border-2 border-transparent hover:border-rose-400 cursor-pointer hover:shadow-md"
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
                          <Repeat className="w-3 h-3 text-rose-600 dark:text-rose-400" aria-label="Recurring" />
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
        <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-700">
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
                  className={`flex items-center justify-between ${!item.isRecurring ? 'cursor-pointer hover:bg-rose-50 dark:hover:bg-rose-950/30 p-2 rounded transition-all duration-200 hover:shadow-sm' : ''}`}
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
                    {item.isRecurring && <Repeat className="w-3 h-3 text-rose-600 dark:text-rose-400" aria-label="Recurring" />}
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
    <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center">
            <span className="text-rose-600 dark:text-rose-400 mr-2">🔄</span>
            Partner's Recurring Expenses
          </h3>
          
          {items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-lg font-medium mb-2">No Recurring Expenses</p>
              <p className="text-sm">Your partner hasn't added any recurring expenses yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((r) => (
                <Card key={r.id} className="bg-gradient-to-br from-white to-rose-50/50 dark:from-gray-900 dark:to-rose-950/10 border-rose-200 dark:border-rose-800 hover:shadow-md transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate mb-1">{r.name}</div>
                        <div className="flex items-center space-x-3 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <div
                              className="w-4 h-4 rounded-full mr-2 border-2 shadow-sm"
                              style={{ 
                                backgroundColor: categoryById.get(r.categoryId || '')?.color || '#6B7280',
                                borderColor: (categoryById.get(r.categoryId || '')?.color || '#6B7280') + '60',
                                boxShadow: `0 0 0 2px ${(categoryById.get(r.categoryId || '')?.color || '#6B7280')}20`
                              }}
                            />
                            {categoryById.get(r.categoryId || '')?.name || 'Uncategorized'}
                          </span>
                          <span className="text-rose-600 dark:text-rose-400 font-medium">
                            {r.frequency}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 shrink-0">
                        <span className="font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/30 px-3 py-1 rounded-full text-sm">
                          {symbol}{formatAmountDisplay(parseFloat(r.amount || '0'))}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
