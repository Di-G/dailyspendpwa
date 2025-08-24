import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight, Minus, Calculator, TrendingUp, Users } from "lucide-react";
import { type CurrencyCode, CURRENCIES } from "@/lib/currencies";
import { formatAmountDisplay } from "@/lib/utils";
import { getTrips, getTripExpensesRaw, cleanupOrphanedTripData } from "@/lib/localStorage";

interface TripInsightsProps {
  currency: CurrencyCode;
}

type Trip = { id: string; name: string; friends: { name: string }[] };
type TripExpense = { 
  id: string; 
  tripId: string; 
  friendIndex: number; 
  name: string; 
  amount: string; 
  details?: string | null; 
  date: string; 
  createdAt: string;
  splitWith: number[]; // Array of friend indices who should split this expense
};

interface SettlementSummary {
  friendIndex: number;
  friendName: string;
  totalPaid: number;
  fairShare: number;
  netAmount: number;
  shouldReceive: number;
  shouldPay: number;
}

interface PaymentTransfer {
  from: string;
  to: string;
  amount: number;
}

export default function TripInsights({ currency }: TripInsightsProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('all'); // 'all' for entire trip, or specific date
  const [tripDataRev, setTripDataRev] = useState<number>(0);

  const symbol = CURRENCIES[currency].symbol;

  // Refresh data when storage changes
  useEffect(() => {
    const onChanged = () => {
      setTripDataRev((v) => v + 1);
    };
    window.addEventListener('dailyspend:data-changed', onChanged);
    return () => window.removeEventListener('dailyspend:data-changed', onChanged);
  }, []);

  // Update trips when data changes
  useEffect(() => {
    const currentTrips = getTrips();
    setTrips(currentTrips);
    if (currentTrips.length > 0 && !activeTripId) {
      setActiveTripId(currentTrips[0].id);
    }
    
    // Clean up any orphaned trip data
    cleanupOrphanedTripData();
  }, [tripDataRev, activeTripId]);

  const activeTrip = trips.find(t => t.id === activeTripId);

  // Calculate settlements
  const settlementData = useMemo((): SettlementSummary[] => {
    if (!activeTrip) return [];

    const allExpenses = getTripExpensesRaw();
    const tripExpenses = allExpenses.filter(e => e.tripId === activeTrip.id);
    
    // Filter by date if specific date is selected
    const filteredExpenses = selectedDate === 'all' 
      ? tripExpenses 
      : tripExpenses.filter(e => e.date === selectedDate);

    if (filteredExpenses.length === 0) return [];

    // Calculate total expenses and fair share per person
    let totalExpenses = 0;
    const friendExpenseShares = new Map<number, number>(); // How much each friend owes for expenses they're part of
    
    filteredExpenses.forEach(expense => {
      const amount = parseFloat(expense.amount || '0');
      totalExpenses += amount;
      
      // Calculate how much each friend owes for this expense based on splitWith
      const splitWith = expense.splitWith && expense.splitWith.length > 0 ? expense.splitWith : [expense.friendIndex];
      const amountPerPerson = amount / splitWith.length;
      
      splitWith.forEach(friendIdx => {
        const current = friendExpenseShares.get(friendIdx) || 0;
        friendExpenseShares.set(friendIdx, current + amountPerPerson);
      });
    });

    // Calculate what each friend paid
    const friendPayments = new Map<number, number>();
    filteredExpenses.forEach(expense => {
      const current = friendPayments.get(expense.friendIndex) || 0;
      friendPayments.set(expense.friendIndex, current + parseFloat(expense.amount || '0'));
    });

    // Calculate settlements for each friend
    return activeTrip.friends.map((friend, index) => {
      const totalPaid = friendPayments.get(index) || 0;
      const fairShare = friendExpenseShares.get(index) || 0; // What they owe based on expenses they participated in
      const netAmount = totalPaid - fairShare;
      
      return {
        friendIndex: index,
        friendName: friend.name || `Friend ${index + 1}`,
        totalPaid,
        fairShare,
        netAmount,
        shouldReceive: netAmount > 0 ? netAmount : 0,
        shouldPay: netAmount < 0 ? Math.abs(netAmount) : 0,
      };
    });
  }, [activeTrip, selectedDate, tripDataRev]);

  // Get unique dates for the trip
  const tripDates = useMemo(() => {
    if (!activeTrip) return [];
    const allExpenses = getTripExpensesRaw();
    const tripExpenses = allExpenses.filter(e => e.tripId === activeTrip.id);
    const dates = [...new Set(tripExpenses.map(e => e.date))].sort();
    return dates;
  }, [activeTrip, tripDataRev]);

  // Calculate total trip expenses
  const totalTripExpenses = useMemo(() => {
    if (!activeTrip) return 0;
    const allExpenses = getTripExpensesRaw();
    const tripExpenses = allExpenses.filter(e => e.tripId === activeTrip.id);
    return tripExpenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  }, [activeTrip, tripDataRev]);

  // Calculate total expenses for selected date
  const totalSelectedExpenses = useMemo(() => {
    if (!activeTrip || selectedDate === 'all') return totalTripExpenses;
    const allExpenses = getTripExpensesRaw();
    const tripExpenses = allExpenses.filter(e => e.tripId === activeTrip.id && e.date === selectedDate);
    return tripExpenses.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);
  }, [activeTrip, selectedDate, totalTripExpenses, tripDataRev]);

  // Get expenses for current view (selected date or all)
  const currentViewExpenses = useMemo(() => {
    if (!activeTrip) return [];
    const allExpenses = getTripExpensesRaw();
    if (selectedDate === 'all') {
      return allExpenses.filter(e => e.tripId === activeTrip.id);
    } else {
      return allExpenses.filter(e => e.tripId === activeTrip.id && e.date === selectedDate);
    }
  }, [activeTrip, selectedDate, tripDataRev]);

  // Calculate optimal payment transfers
  const paymentTransfers = useMemo((): PaymentTransfer[] => {
    if (!settlementData.length) return [];
    
    const receivers = settlementData
      .filter(s => s.shouldReceive > 0)
      .map(s => ({ ...s })) // Create a copy to avoid modifying original data
      .sort((a, b) => b.shouldReceive - a.shouldReceive);
    
    const payers = settlementData
      .filter(s => s.shouldPay > 0)
      .map(s => ({ ...s })) // Create a copy to avoid modifying original data
      .sort((a, b) => b.shouldPay - a.shouldPay);
    
    const transfers: PaymentTransfer[] = [];
    const remainingReceivers = [...receivers];
    const remainingPayers = [...payers];
    
    // Match payers with receivers
    for (const payer of remainingPayers) {
      let remainingToPay = payer.shouldPay;
      
      while (remainingToPay > 0 && remainingReceivers.length > 0) {
        const receiver = remainingReceivers[0];
        const transferAmount = Math.min(remainingToPay, receiver.shouldReceive);
        
        if (transferAmount > 0) {
          transfers.push({
            from: payer.friendName,
            to: receiver.friendName,
            amount: transferAmount
          });
          
          remainingToPay -= transferAmount;
          receiver.shouldReceive -= transferAmount;
          
          if (receiver.shouldReceive <= 0) {
            remainingReceivers.shift();
          }
        } else {
          break;
        }
      }
    }
    
    return transfers;
  }, [settlementData]);

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Calculator className="w-12 h-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">No Trips Available</h2>
          <p className="text-sm text-muted-foreground">Create a trip first to see expense insights and settlements.</p>
        </div>
      </div>
    );
  }

  if (!activeTrip) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Calculator className="w-12 h-12 text-muted-foreground" />
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Select a Trip</h2>
          <p className="text-sm text-muted-foreground">Choose a trip to view expense insights and settlements.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-2">Trip Insights & Settlements</h2>
              <p className="text-sm text-muted-foreground">Calculate fair expense distribution among trip participants</p>
            </div>
            <div className="flex items-center space-x-2">
              <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Auto-calculated</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trip and Date Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Select Trip</label>
            <Select value={activeTripId} onValueChange={setActiveTripId}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700">
                <SelectValue placeholder="Choose a trip" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {trip.name} ({trip.friends.length} friends)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <label className="text-sm font-medium text-foreground mb-2 block">Time Period</label>
            <Select value={selectedDate} onValueChange={setSelectedDate}>
              <SelectTrigger className="bg-white dark:bg-gray-800 border-purple-200 dark:border-purple-700">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entire Trip</SelectItem>
                {tripDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {new Date(date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
            </div>
            {(() => {
              // Check if there are any expenses with partial splitting (including individual expenses)
              const hasPartialSplits = currentViewExpenses.some((expense: any) => {
                const splitCount = (expense.splitWith && expense.splitWith.length > 0) ? expense.splitWith.length : 1;
                return splitCount !== activeTrip.friends.length;
              });
              
              if (hasPartialSplits) {
                // Calculate expenses split between all people only
                const allPeopleExpenses = currentViewExpenses.filter((expense: any) => {
                  const splitCount = (expense.splitWith && expense.splitWith.length > 0) ? expense.splitWith.length : 1;
                  return splitCount === activeTrip.friends.length;
                });
                
                const allPeopleTotal = allPeopleExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
                
                return (
                  <div className="flex space-x-4 mt-2">
                    {/* All people split expenses */}
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-foreground">
                        {symbol}{formatAmountDisplay(allPeopleTotal)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        All people split
                      </p>
                    </div>
                    
                    {/* Vertical divider */}
                    <div className="border-l border-blue-200 dark:border-blue-700"></div>
                    
                    {/* Total expenses */}
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-foreground">
                        {symbol}{formatAmountDisplay(totalSelectedExpenses)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total expenses
                      </p>
                    </div>
                  </div>
                );
              } else {
                // Normal behavior when no partial splits
                return (
                  <>
                    <p className="text-2xl font-bold text-foreground mt-2">
                      {symbol}{formatAmountDisplay(totalSelectedExpenses)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedDate === 'all' ? 'Entire trip' : `On ${new Date(selectedDate).toLocaleDateString()}`}
                    </p>
                  </>
                );
              }
            })()}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:border-green-200 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-muted-foreground">Fair Share</span>
            </div>
            {(() => {
              // Check if there are any expenses with partial splitting (including individual expenses)
              const hasPartialSplits = currentViewExpenses.some((expense: any) => {
                const splitCount = (expense.splitWith && expense.splitWith.length > 0) ? expense.splitWith.length : 1;
                return splitCount !== activeTrip.friends.length;
              });
              
              if (hasPartialSplits) {
                // Calculate expenses split between all people only
                const allPeopleExpenses = currentViewExpenses.filter((expense: any) => {
                  const splitCount = (expense.splitWith && expense.splitWith.length > 0) ? expense.splitWith.length : 1;
                  return splitCount === activeTrip.friends.length;
                });
                
                const allPeopleTotal = allPeopleExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || '0'), 0);
                const allPeopleFairShare = allPeopleTotal / activeTrip.friends.length;
                
                return (
                  <div className="flex space-x-4 mt-2">
                    {/* All people split fair share */}
                    <div className="flex-1">
                      <p className="text-2xl font-bold text-foreground">
                        {symbol}{formatAmountDisplay(allPeopleFairShare)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        All people split
                      </p>
                    </div>
                    
                    {/* Vertical divider */}
                    <div className="border-l border-green-200 dark:border-green-700"></div>
                    
                    {/* Total fair share */}
                    <div className="flex-1">
                      <p className="text-lg font-semibold text-foreground">
                        {symbol}{formatAmountDisplay(totalSelectedExpenses / activeTrip.friends.length)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total per person
                      </p>
                    </div>
                  </div>
                );
              } else {
                // Normal behavior when no partial splits
                return (
                  <>
                    <p className="text-2xl font-bold text-foreground mt-2">
                      {symbol}{formatAmountDisplay(totalSelectedExpenses / activeTrip.friends.length)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Per person ({activeTrip.friends.length} friends)
                    </p>
                  </>
                );
              }
            })()}
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/20 dark:to-violet-950/20 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-muted-foreground">Settlements</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-2">
              {settlementData.filter(s => s.shouldReceive > 0 || s.shouldPay > 0).length}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Pending transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Settlement Details */}
      <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-700">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calculator className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>Expense Settlements</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {settlementData.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No expenses found for the selected period.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {settlementData.map((settlement, index) => (
                <div key={settlement.friendIndex} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-3 h-3 rounded-full shadow-sm" 
                        style={{ 
                          backgroundColor: [
                            '#14B8A6', // teal
                            '#6366F1', // indigo
                            '#84CC16', // lime
                            '#D946EF', // fuchsia
                            '#F97316', // orange
                          ][index % 5]
                        }} 
                      />
                      <div>
                        <p className="font-medium text-foreground">{settlement.friendName}</p>
                        <p className="text-sm text-muted-foreground">
                          Paid: {symbol}{formatAmountDisplay(settlement.totalPaid)} | 
                          Fair share: {symbol}{formatAmountDisplay(settlement.fairShare)}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {settlement.shouldReceive > 0 ? (
                        <div className="flex items-center space-x-2">
                          <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                          <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                            +{symbol}{formatAmountDisplay(settlement.shouldReceive)}
                          </Badge>
                        </div>
                      ) : settlement.shouldPay > 0 ? (
                        <div className="flex items-center space-x-2">
                          <ArrowDownRight className="w-4 h-4 text-red-600 dark:text-red-400" />
                          <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700">
                            -{symbol}{formatAmountDisplay(settlement.shouldPay)}
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                            Settled
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Settlement Instructions */}
      {paymentTransfers.length > 0 && (
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <ArrowUpRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Payment Instructions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paymentTransfers.map((transfer, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-blue-100/50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-blue-800 dark:text-blue-200">{transfer.from}</span>
                      <ArrowDownRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="font-medium text-blue-800 dark:text-blue-200">{transfer.to}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-800 dark:text-blue-200 dark:border-blue-600">
                      {symbol}{formatAmountDisplay(transfer.amount)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Summary */}
            <div className="mt-4 p-3 bg-gray-100/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Total transfers:</strong> {paymentTransfers.length} payment(s) needed
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                This minimizes the number of transactions needed to settle all expenses
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settlement Summary */}
      {settlementData.some(s => s.shouldReceive > 0 || s.shouldPay > 0) && (
        <Card className="bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/50 dark:to-gray-900/50 border-slate-200 dark:border-slate-700">
          <CardHeader>
            <CardTitle>Settlement Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {settlementData
                .filter(s => s.shouldReceive > 0)
                .map((settlement) => (
                  <div key={settlement.friendIndex} className="flex items-center justify-between p-3 bg-green-100/50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">
                        {settlement.friendName} should receive
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        {symbol}{formatAmountDisplay(settlement.shouldReceive)}
                      </p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                ))}
              
              {settlementData
                .filter(s => s.shouldPay > 0)
                .map((settlement) => (
                  <div key={settlement.friendIndex} className="flex items-center justify-between p-3 bg-red-100/50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-200">
                        {settlement.friendName} should pay
                      </p>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {symbol}{formatAmountDisplay(settlement.shouldPay)}
                      </p>
                    </div>
                    <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
