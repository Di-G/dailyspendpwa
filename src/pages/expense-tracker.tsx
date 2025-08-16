import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, Users, Plus, ChevronDown } from "lucide-react";
import ExpenseEntry from "@/components/expense-entry";
import ChartsView from "@/components/charts-view";
import CalendarView from "@/components/calendar-view";
import RecurringExpenses from "@/components/recurring-expenses";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import BottomNavigation from "@/components/bottom-navigation";
import FloatingActionButton from "@/components/floating-action-button";
import ThemeToggle from "@/components/theme-toggle";
import Profile from "@/components/profile";
import FriendSelector from "@/components/friend-selector";
import ImportFriendExpenses from "@/components/import-friend-expenses";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import SettingsDrawer from "@/components/settings-drawer";
import { queryClient } from "@/lib/queryClient";
import { Friend } from "@shared/schema";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getFriends, addFriend, removeFriend } from "@/lib/localStorage";
import { downloadFriendData } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type ViewType = "entry" | "charts" | "calendar" | "recurring";
type CurrencyCode = "USD" | "INR";
type ExpenseMode = "my" | "friend";

export default function ExpenseTracker() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>("my");
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [friendData, setFriendData] = useState<any>(null);
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_currency") as CurrencyCode | null;
    return saved || "USD";
  });
  const isMobile = useIsMobile();
  const [focusAmountTrigger, setFocusAmountTrigger] = useState<number | null>(null);
  // Temporarily disabled sliding state variables
  // const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  // const [slideProgress, setSlideProgress] = useState(0);
  // const [isDragging, setIsDragging] = useState(false);
  
  // Friend dropdown state
  const [showFriendDropdown, setShowFriendDropdown] = useState(false);
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [newFriendName, setNewFriendName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const friendDropdownRef = useRef<HTMLDivElement>(null);
  const friendsTabRef = useRef<HTMLButtonElement>(null);
  const { toast } = useToast();

  const navigationItems = [
    {
      id: "entry",
      label: "Home",
      icon: "🏠",
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: "📅",
    },
    {
      id: "charts",
      label: "Insights",
      icon: "📊",
    },
    {
      id: "recurring",
      label: "Recurring",
      icon: "🔄",
    },
  ];

  // Calculate current index for navigation
  const currentIndex = navigationItems.findIndex(item => item.id === currentView);

  // Pull-to-refresh disabled

  const handleFabClick = () => {
    handleViewChange("entry");
    setFocusAmountTrigger((t) => (t ?? 0) + 1);
  };

  const handleFriendSelect = (friend: Friend | null) => {
    setSelectedFriend(friend);
    if (friend) {
      setExpenseMode("friend");
    } else {
      setExpenseMode("my");
    }
  };

  const handleFriendDataLoad = (data: any) => {
    setFriendData(data);
  };

  const isFriendMode = expenseMode === "friend" && !!selectedFriend && !!friendData;

  const handleTabChange = (value: string) => {
    if (value === "my") {
      setExpenseMode("my");
      setSelectedFriend(null);
      setFriendData(null);
    } else if (value === "friend") {
      setExpenseMode("friend");
      // Keep existing friend selection if any
    }
  };

  const handleViewChange = (view: ViewType) => {
    setCurrentView(view);
  };

  // Long press functionality for Friends tab
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [isLongPressing, setIsLongPressing] = useState(false);

  const handleFriendsTabMouseDown = () => {
    const timer = setTimeout(() => {
      setIsLongPressing(true);
      setShowFriendDropdown(true);
    }, 500); // 500ms for long press
    setLongPressTimer(timer);
  };

  const handleFriendsTabMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setIsLongPressing(false);
  };

  const handleFriendsTabClick = () => {
    if (!isLongPressing) {
      handleTabChange("friend");
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (friendDropdownRef.current && !friendDropdownRef.current.contains(event.target as Node)) {
        setShowFriendDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Friend management functions
  const friends = getFriends(user?.uid);
  const safeFriends = Array.isArray(friends) ? friends : [];
  const showFriendOverlay = expenseMode === "friend" && safeFriends.length === 0;

  const handleAddFriend = async () => {
    if (!newFriendEmail || !newFriendName) {
      toast({ title: "Missing information", description: "Please fill in both email and name.", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      const friend = addFriend({
        userId: newFriendEmail,
        displayName: newFriendName,
        email: newFriendEmail,
      }, user?.uid);
      
      setNewFriendEmail("");
      setNewFriendName("");
      setIsAddingFriend(false);
      setShowFriendDropdown(false);
      
      toast({ title: "Friend added", description: `${friend.displayName || 'Friend'} has been added to your friends list.` });
    } catch (error) {
      toast({ title: "Failed to add friend", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFriend = async (friend: Friend) => {
    try {
      setIsLoading(true);
      const friendData = await downloadFriendData(friend.userId);
      if (friendData) {
        handleFriendSelect(friend);
        handleFriendDataLoad(friendData);
        setShowFriendDropdown(false);
        toast({ title: "Friend data loaded", description: `Viewing ${friend.displayName || 'Friend'}'s expenses.` });
      } else {
        handleFriendSelect(friend);
        handleFriendDataLoad({ expenses: [], categories: [], recurring: [] });
        setShowFriendDropdown(false);
        toast({ title: "No data found", description: `${friend.displayName || 'Friend'} doesn't have any data yet.`, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error loading friend data:', error);
      toast({ title: "Failed to load friend data", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFriend = (friendId: string) => {
    removeFriend(friendId, user?.uid);
    if (selectedFriend?.id === friendId) {
      handleFriendSelect(null);
      handleFriendDataLoad(null);
    }
    toast({ title: "Friend removed", description: "Friend has been removed from your list." });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Title Bar */}
      <header className="bg-card shadow-sm border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center cursor-pointer" onClick={() => handleViewChange("entry") }>
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

      {/* Expense Mode Tabs */}
      <div className="bg-card border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-stretch h-16">
            <div className="flex items-stretch h-16 w-auto">
              <button
                onClick={() => handleTabChange("my")}
                className={`flex flex-col items-center justify-center transition-all duration-200 px-8 ${
                  expenseMode === "my"
                    ? "bg-primary text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Wallet className={`w-5 h-5 mb-1 ${expenseMode === "my" ? "text-white" : "text-gray-600"}`} />
                <span className={`text-xs font-medium ${expenseMode === "my" ? "text-white" : "text-gray-600"}`}>
                  My Expenses
                </span>
              </button>
              <div className="relative">
                <button
                  ref={friendsTabRef}
                  onMouseDown={handleFriendsTabMouseDown}
                  onMouseUp={handleFriendsTabMouseUp}
                  onMouseLeave={handleFriendsTabMouseUp}
                  onTouchStart={handleFriendsTabMouseDown}
                  onTouchEnd={handleFriendsTabMouseUp}
                  onClick={handleFriendsTabClick}
                  className={`flex flex-col items-center justify-center transition-all duration-200 px-8 ${
                    expenseMode === "friend"
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Users className={`w-5 h-5 mb-1 ${expenseMode === "friend" ? "text-white" : "text-gray-600"}`} />
                  <span className={`text-xs font-medium ${expenseMode === "friend" ? "text-white" : "text-gray-600"}`}>
                    Friends
                  </span>
                  <ChevronDown className={`w-3 h-3 mt-1 ${expenseMode === "friend" ? "text-white" : "text-gray-600"}`} />
                </button>
                
                {/* Friend Dropdown */}
                {showFriendDropdown && (
                  <div 
                    ref={friendDropdownRef}
                    className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50"
                  >
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="text-sm font-medium text-gray-900">Friends</h3>
                    </div>
                    
                    {safeFriends.length > 0 ? (
                      <div className="max-h-48 overflow-y-auto">
                        {safeFriends.map((friend) => (
                          <div key={friend.id} className="flex items-center justify-between p-3 hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <Users className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-900">{friend.displayName}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSelectFriend(friend)}
                                disabled={isLoading}
                              >
                                Select
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFriend(friend.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-gray-500 text-center">
                        No friends added yet
                      </div>
                    )}
                    
                    <div className="p-3 border-t border-gray-200">
                      {!isAddingFriend ? (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => setIsAddingFriend(true)}
                          className="w-full"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add New Friend
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <input
                            type="text"
                            placeholder="Friend's name"
                            value={newFriendName}
                            onChange={(e) => setNewFriendName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <input
                            type="email"
                            placeholder="Friend's email"
                            value={newFriendEmail}
                            onChange={(e) => setNewFriendEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          />
                          <div className="flex space-x-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setIsAddingFriend(false)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleAddFriend}
                              disabled={isLoading}
                              className="flex-1"
                            >
                              {isLoading ? "Adding..." : "Add"}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {expenseMode === "my" && (
            <div className="mt-4 pb-4">
            </div>
          )}
          
          {expenseMode === "friend" && selectedFriend && (
            <div className="mt-4 pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Viewing {selectedFriend.displayName}'s expenses
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedFriend(null);
                    setExpenseMode("my");
                    setFriendData(null);
                  }}
                >
                  Switch to My Data
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Secondary Nav Bar - Only show on desktop */}
      {!isMobile && (
        <div className="bg-card border-b border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2 sm:space-x-4 h-12">
              <Button
                onClick={() => handleViewChange("entry")}
                size="default"
                className={`${currentView === "entry" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                Home
              </Button>
              <Button
                onClick={() => handleViewChange("calendar")}
                size="default"
                className={`${currentView === "calendar" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar View
              </Button>
              <Button
                onClick={() => handleViewChange("charts")}
                size="default"
                className={`${currentView === "charts" ? "bg-secondary hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Insights
              </Button>
              <Button
                onClick={() => handleViewChange("recurring")}
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
      <div className="relative">
        <div 
          className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 ${isMobile ? 'pb-[calc(env(safe-area-inset-bottom)+7rem)]' : ''} ${showFriendOverlay ? 'blur-sm pointer-events-none select-none' : ''}`}
        >
          {currentView === "entry" && (
            <ExpenseEntry
              currency={currency}
              setCurrency={setCurrency}
              focusAmountTrigger={focusAmountTrigger}
              onFocusAmountConsumed={() => setFocusAmountTrigger(null)}
              isFriendMode={isFriendMode}
              friendData={friendData}
              selectedFriend={selectedFriend}
            />
          )}
          {currentView === "charts" && (
            <ChartsView 
              currency={currency} 
              isFriendMode={isFriendMode}
              friendData={friendData}
            />
          )}
          {currentView === "calendar" && (
            <CalendarView 
              currency={currency} 
              isFriendMode={isFriendMode}
              friendData={friendData}
            />
          )}
          {currentView === "recurring" && (
            <RecurringExpenses 
              currency={currency} 
              isFriendMode={isFriendMode}
              friendData={friendData}
            />
          )}
        </div>

        {showFriendOverlay && (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="max-w-md w-full bg-card/90 backdrop-blur rounded-xl border border-muted p-6 text-center shadow-md">
              <h2 className="text-lg font-semibold text-foreground mb-2">Add a friend to view their expenses</h2>
              <p className="text-sm text-muted-foreground mb-4">Use the Friends tab menu to add your first friend. Once added, you'll be able to view their expenses in read-only mode.</p>
              <div className="flex items-center justify-center">
                <Button onClick={() => setShowFriendDropdown(true)}>
                  Add Friend
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Next/Previous Screen Preview (underneath) */}
      {/* Removed sliding preview as sliding is disabled */}

      {/* Floating Action Button - Mobile only */}
      <FloatingActionButton 
        onClick={handleFabClick}
        isFriendMode={isFriendMode}
        selectedFriend={selectedFriend}
        friendData={friendData}
        currentView={currentView}
      />

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={(v) => handleViewChange(v as ViewType)}
        // Temporarily disabled sliding props
        // onSlideProgress={(progress, direction) => {
        //   setSlideProgress(progress);
        //   setSlideDirection(direction);
        // }}
        // onSlideStart={() => setIsDragging(true)}
        // onSlideEnd={() => setIsDragging(false)}
      />

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />
    </div>
  );
}
