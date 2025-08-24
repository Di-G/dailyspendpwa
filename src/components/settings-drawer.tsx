import { useEffect, useMemo, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CategoryManagement from "@/components/category-management";
import PartnerManagement from "@/components/partner-management";
import FollowupsManagement from "@/components/followups-management";
import { useToast } from "@/hooks/use-toast";
import { getExpenses, getCategories, updateAllData, initializeDefaultCategories, getTripExpensesRaw, setTripExpensesRaw, getTripRecurringRaw, setTripRecurringRaw, cleanupOrphanedTripData } from "@/lib/localStorage";
import { useAuth } from "@/lib/auth";
import { subscribeToIncomingRequests, subscribeToOutgoingRequests, updatePartnerRequestStatus, deletePartnerRequest, subscribeToAcceptedIncomingPartners, type PartnerRequest, subscribeToIncomingFollowups, subscribeToOutgoingFollowups, subscribeToAcceptedIncomingFollowups, updateFollowupRequestStatus, deleteFollowupRequest, type FollowupRequest } from "@/lib/sync";
import { Trash, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { type CurrencyCode, CURRENCIES } from "@/lib/currencies";

interface SettingsDrawerProps {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  topTab?: "my" | "couple" | "trips" | "followups";
  onPartnerRemoved?: (requestId: string) => void;
  onTripsChanged?: (hasTrips: boolean) => void;
}

export default function SettingsDrawer({ currency, setCurrency, topTab = "my", onPartnerRemoved, onTripsChanged }: SettingsDrawerProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuth();
  const [open, setOpen] = useState<{
    currency: boolean;
    categories: boolean;
    export: boolean;
  }>({ currency: false, categories: false, export: false });
  const [outgoing, setOutgoing] = useState<PartnerRequest[]>([]);
  const [incoming, setIncoming] = useState<PartnerRequest[]>([]);
  const [acceptedIncomingPartners, setAcceptedIncomingPartners] = useState<PartnerRequest[]>([]);
  const [outgoingFollowups, setOutgoingFollowups] = useState<FollowupRequest[]>([]);
  const [incomingFollowups, setIncomingFollowups] = useState<FollowupRequest[]>([]);
  const [acceptedIncomingFollowups, setAcceptedIncomingFollowups] = useState<FollowupRequest[]>([]);

  useEffect(() => {
    let stopOut: null | (() => void) = null;
    let stopIn: null | (() => void) = null;
    let stopAcceptedIncoming: null | (() => void) = null;
    let stopFUOut: null | (() => void) = null;
    let stopFUIn: null | (() => void) = null;
    let stopFUAcceptedIn: null | (() => void) = null;
    if (user) {
      stopOut = subscribeToOutgoingRequests(user.uid, setOutgoing);
      stopIn = subscribeToIncomingRequests(user.uid, setIncoming);
      stopAcceptedIncoming = subscribeToAcceptedIncomingPartners(user.uid, setAcceptedIncomingPartners);
      // Follow-ups
      stopFUOut = subscribeToOutgoingFollowups(user.uid, setOutgoingFollowups);
      stopFUIn = subscribeToIncomingFollowups(user.uid, setIncomingFollowups);
      stopFUAcceptedIn = subscribeToAcceptedIncomingFollowups(user.uid, setAcceptedIncomingFollowups);
    }
    return () => {
      try { stopOut?.(); } catch {}
      try { stopIn?.(); } catch {}
      try { stopAcceptedIncoming?.(); } catch {}
      try { stopFUOut?.(); } catch {}
      try { stopFUIn?.(); } catch {}
      try { stopFUAcceptedIn?.(); } catch {}
    };
  }, [user?.uid]);

  // Persist currency preference
  const onCurrencyChange = (value: string) => {
    const next = (value as CurrencyCode);
    const storageKey = topTab === 'trips' ? "dailyspend_trips_currency" : "dailyspend_expenses_currency";
    localStorage.setItem(storageKey, next);
    setCurrency(next);
    const context = topTab === 'trips' ? 'trips' : 'expenses';
    toast({ title: "Currency updated", description: `${context} now using ${next}` });
  };

  const data = useMemo(() => {
    const categories = getCategories();
    const expenses = getExpenses();
    return { categories, expenses };
  }, []);

  // Trips data for import/export/delete
  const tripsData = useMemo(() => {
    const trips = JSON.parse(localStorage.getItem('dailyspend_trips') || '[]');
    const tripExpenses = getTripExpensesRaw();
    const tripRecurring = getTripRecurringRaw();
    return { trips, tripExpenses, tripRecurring };
  }, []);

  const buildCsv = () => {
    const { categories, expenses } = data;
    const header = [
      "type",
      "id",
      "name",
      "color",
      "createdAt",
      "expense_name",
      "amount",
      "details",
      "categoryId",
      "categoryName",
      "date",
      "expense_createdAt",
    ];
    const lines: string[] = [header.join(",")];
    categories.forEach((c) => {
      lines.push([
        "category",
        safeCsv(c.id),
        safeCsv(c.name),
        safeCsv(c.color),
        safeCsv(c.createdAt),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ].join(","));
    });
    const categoryById = new Map(categories.map((c: any) => [c.id, c]));
    expenses.forEach((e) => {
      const cat = e.categoryId ? categoryById.get(e.categoryId) : null;
      lines.push([
        "expense",
        safeCsv(e.id),
        "",
        "",
        "",
        safeCsv(e.name),
        safeCsv(e.amount),
        safeCsv(e.details ?? ""),
        safeCsv(e.categoryId ?? ""),
        safeCsv(cat?.name ?? ""),
        safeCsv(e.date),
        safeCsv(e.createdAt),
      ].join(","));
    });
    return lines.join("\n");
  };

  const buildTripsCsv = () => {
    const { trips, tripExpenses, tripRecurring } = tripsData;
    const header = [
      "type",
      "id",
      "tripId",
      "name",
      "friends",
      "createdAt",
      "expense_name",
      "amount",
      "details",
      "friendIndex",
      "date",
      "expense_createdAt",
      "frequency",
      "customDays",
      "startDate",
      "endDate",
      "isActive"
    ];
    const lines: string[] = [header.join(",")];
    
    // Add trips
    trips.forEach((t) => {
      lines.push([
        "trip",
        safeCsv(t.id),
        safeCsv(t.id),
        safeCsv(t.name),
        safeCsv(JSON.stringify(t.friends)),
        safeCsv(t.createdAt || new Date().toISOString()),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        ""
      ].join(","));
    });
    
    // Add trip expenses
    tripExpenses.forEach((e) => {
      lines.push([
        "trip_expense",
        safeCsv(e.id),
        safeCsv(e.tripId),
        "",
        "",
        "",
        safeCsv(e.name),
        safeCsv(e.amount),
        safeCsv(e.details ?? ""),
        safeCsv(e.friendIndex),
        safeCsv(e.date),
        safeCsv(e.createdAt),
        "",
        "",
        "",
        "",
        ""
      ].join(","));
    });
    
    // Add trip recurring
    tripRecurring.forEach((r) => {
      lines.push([
        "trip_recurring",
        safeCsv(r.id),
        safeCsv(r.tripId),
        "",
        "",
        "",
        safeCsv(r.name),
        safeCsv(r.amount),
        safeCsv(r.details ?? ""),
        safeCsv(r.friendIndex),
        "",
        safeCsv(r.createdAt),
        safeCsv(r.frequency),
        safeCsv(r.customDays || ""),
        safeCsv(r.startDate),
        safeCsv(r.endDate || ""),
        safeCsv(r.isActive)
      ].join(","));
    });
    
    return lines.join("\n");
  };

  const safeCsv = (value: any) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes("\n") || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const handleExport = async (format: "excel" | "pdf") => {
    try {
      setExporting(true);
      if (format === "excel") {
        const csv = topTab === 'trips' ? buildTripsCsv() : buildCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const filename = topTab === 'trips' 
          ? `trips-export-${new Date().toISOString().slice(0,10)}.csv`
          : `daily-spends-export-${new Date().toISOString().slice(0,10)}.csv`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        const description = topTab === 'trips' 
          ? "Trips data exported as CSV (openable in Excel)"
          : "Data exported as CSV (openable in Excel)";
        toast({ title: "Exported", description });
      } else {
        // Minimal PDF generation: open formatted HTML in new tab and let user save as PDF
        if (topTab === 'trips') {
          const { trips, tripExpenses, tripRecurring } = tripsData;
          const html = `<!doctype html><html><head><meta charset='utf-8'><title>Trips Export</title>
            <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto; padding:24px} h1{font-size:20px} table{border-collapse:collapse;width:100%;margin-top:12px} th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f5f5f5}</style>
          </head><body>
          <h1>Trips Export - ${new Date().toLocaleString()}</h1>
          <h2>Trips</h2>
          <table><thead><tr><th>Name</th><th>Friends</th><th>Created</th></tr></thead><tbody>
          ${trips.map(t => `<tr><td>${t.name}</td><td>${t.friends.map(f => f.name).join(', ')}</td><td>${t.createdAt || 'N/A'}</td></tr>`).join("")}
          </tbody></table>
          <h2 style='margin-top:16px'>Trip Expenses</h2>
          <table><thead><tr><th>Name</th><th>Amount</th><th>Friend</th><th>Date</th><th>Created</th></tr></thead><tbody>
          ${tripExpenses.map(e => `<tr><td>${e.name}</td><td>${e.amount}</td><td>${e.friendIndex}</td><td>${e.date}</td><td>${e.createdAt}</td></tr>`).join("")}
          </tbody></table>
          <h2 style='margin-top:16px'>Trip Recurring</h2>
          <table><thead><tr><th>Name</th><th>Amount</th><th>Friend</th><th>Frequency</th><th>Start Date</th></tr></thead><tbody>
          ${tripRecurring.map(r => `<tr><td>${r.name}</td><td>${r.amount}</td><td>${r.friendIndex}</td><td>${r.frequency}</td><td>${r.startDate}</td></tr>`).join("")}
          </tbody></table>
          <script>window.print()</script>
          </body></html>`;
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast({ title: "PDF Export", description: "Print dialog opened; choose Save as PDF" });
        } else {
          const html = `<!doctype html><html><head><meta charset='utf-8'><title>Daily Spends Export</title>
            <style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto; padding:24px} h1{font-size:20px} table{border-collapse:collapse;width:100%;margin-top:12px} th,td{border:1px solid #ddd;padding:6px;text-align:left} th{background:#f5f5f5}</style>
          </head><body>
          <h1>Daily Spends Export - ${new Date().toLocaleString()}</h1>
          <h2>Categories</h2>
          <table><thead><tr><th>Name</th><th>Color</th><th>Created</th></tr></thead><tbody>
          ${data.categories.map(c => `<tr><td>${c.name}</td><td>${c.color}</td><td>${c.createdAt}</td></tr>`).join("")}
          </tbody></table>
          <h2 style='margin-top:16px'>Expenses</h2>
          <table><thead><tr><th>Name</th><th>Amount</th><th>CategoryId</th><th>Date</th><th>Created</th></tr></thead><tbody>
          ${data.expenses.map(e => `<tr><td>${e.name}</td><td>${e.amount}</td><td>${e.categoryId ?? ''}</td><td>${e.date}</td><td>${e.createdAt}</td></tr>`).join("")}
          </tbody></table>
          <script>window.print()</script>
          </body></html>`;
          const blob = new Blob([html], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          window.open(url, "_blank");
          toast({ title: "PDF Export", description: "Print dialog opened; choose Save as PDF" });
        }
      }
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file: File) => {
    try {
      setImporting(true);
      const text = await file.text();
      // Parse CSV
      const rows = text.split(/\r?\n/).filter(Boolean);
      const header = rows.shift()?.split(",") || [];
      const idx = (name: string) => header.indexOf(name);
      
      if (topTab === 'trips') {
        // Import trips data
        const trips: any[] = [];
        const tripExpenses: any[] = [];
        const tripRecurring: any[] = [];
        
        for (const line of rows) {
          const cols = parseCsvLine(line);
          const type = cols[idx("type")];
          if (type === "trip") {
            trips.push({
              id: cols[idx("id")],
              name: cols[idx("name")],
              friends: JSON.parse(cols[idx("friends")] || '[]'),
              createdAt: cols[idx("createdAt")],
            });
          } else if (type === "trip_expense") {
            tripExpenses.push({
              id: cols[idx("id")],
              tripId: cols[idx("tripId")],
              name: cols[idx("expense_name")],
              amount: cols[idx("amount")],
              details: cols[idx("details")] || null,
              friendIndex: parseInt(cols[idx("friendIndex")]) || 0,
              date: cols[idx("date")],
              createdAt: cols[idx("expense_createdAt")],
            });
          } else if (type === "trip_recurring") {
            tripRecurring.push({
              id: cols[idx("id")],
              tripId: cols[idx("tripId")],
              name: cols[idx("expense_name")],
              amount: cols[idx("amount")],
              details: cols[idx("details")] || null,
              friendIndex: parseInt(cols[idx("friendIndex")]) || 0,
              frequency: cols[idx("frequency")] || 'monthly',
              customDays: cols[idx("customDays")] ? parseInt(cols[idx("customDays")]) : undefined,
              startDate: cols[idx("startDate")],
              endDate: cols[idx("endDate")] || null,
              isActive: cols[idx("isActive")] === 'true',
            });
          }
        }
        
        if (!trips.length && !tripExpenses.length && !tripRecurring.length) {
          throw new Error("No trips data found in CSV");
        }
        
        localStorage.setItem("dailyspend_trips", JSON.stringify(trips));
        setTripExpensesRaw(tripExpenses);
        setTripRecurringRaw(tripRecurring);
        
        toast({ title: "Trips Imported", description: "Trips data imported successfully. Refreshing..." });
        setTimeout(() => window.location.reload(), 800);
      } else {
        // Import daily expenses data
        const categories: any[] = [];
        const expenses: any[] = [];
        for (const line of rows) {
          const cols = parseCsvLine(line);
          const type = cols[idx("type")];
          if (type === "category") {
            categories.push({
              id: cols[idx("id")],
              name: cols[idx("name")],
              color: cols[idx("color")],
              createdAt: cols[idx("createdAt")],
            });
          } else if (type === "expense") {
            expenses.push({
              id: cols[idx("id")],
              name: cols[idx("expense_name")],
              amount: cols[idx("amount")],
              details: cols[idx("details")] || null,
              categoryId: cols[idx("categoryId")] || null,
              date: cols[idx("date")],
              createdAt: cols[idx("expense_createdAt")],
            });
          }
        }
        if (!categories.length && !expenses.length) {
          throw new Error("No rows found in CSV");
        }
        localStorage.setItem("dailyspend_categories", JSON.stringify(categories));
        localStorage.setItem("dailyspend_expenses", JSON.stringify(expenses));
        toast({ title: "Imported", description: "Data imported. Refreshing..." });
        setTimeout(() => window.location.reload(), 800);
      }
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message || "Unsupported file", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (inQuotes) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++; // skip escaped quote
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === ',') {
          result.push(current);
          current = '';
        } else if (char === '"') {
          inQuotes = true;
        } else {
          current += char;
        }
      }
    }
    result.push(current);
    return result;
  };

  const toggle = (key: keyof typeof open) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleDeleteLocalData = async () => {
    if (user) return; // Safety: should be disabled anyway
    
    if (topTab === 'trips') {
      const confirmed = window.confirm("This will delete ALL local trips data (trips, trip expenses, and trip recurring items). This will NOT affect your daily expenses data. This cannot be undone. Proceed?");
      if (!confirmed) return;
      try {
        setDeleting(true);
        console.log('[Delete All] Clearing all trips data...');
        
        // Get counts for logging
        const tripsCount = JSON.parse(localStorage.getItem('dailyspend_trips') || '[]').length;
        const expensesCount = getTripExpensesRaw().length;
        const recurringCount = getTripRecurringRaw().length;
        
        // Clear all trips data
        localStorage.setItem("dailyspend_trips", JSON.stringify([]));
        setTripExpensesRaw([]);
        setTripRecurringRaw([]);
        
        console.log(`[Delete All] Cleared ${tripsCount} trips, ${expensesCount} expenses, and ${recurringCount} recurring items`);
        
        // Trigger Firebase sync if user is signed in
        if (user) {
          try {
            console.log('[Delete All] Triggering Firebase sync for bulk deletion...');
            window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
          } catch (error) {
            console.error('[Delete All] Failed to trigger Firebase sync:', error);
          }
        }
        
        toast({ 
          title: "Trips data cleared", 
          description: `Removed ${tripsCount} trips, ${expensesCount} expenses, and ${recurringCount} recurring items. Your daily expenses remain untouched.` 
        });
        setTimeout(() => window.location.reload(), 600);
      } catch (e: any) {
        console.error('[Delete All] Failed to clear trips data:', e);
        toast({ title: "Delete failed", description: e?.message || "Unable to clear trips data", variant: "destructive" });
      } finally {
        setDeleting(false);
      }
    } else {
      const confirmed = window.confirm("This will delete ALL local expenses and recurring items, and restore categories to defaults. This cannot be undone. Proceed?");
      if (!confirmed) return;
      try {
        setDeleting(true);
        // Clear all local datasets
        updateAllData([], [], []);
        // Clear any last processed date for recurring safety
        try { localStorage.removeItem("dailyspend_last_processed_date"); } catch {}
        // Restore default categories
        initializeDefaultCategories();
        toast({ title: "Local data cleared", description: "All local expenses removed and categories reset." });
        setTimeout(() => window.location.reload(), 600);
      } catch (e: any) {
        toast({ title: "Delete failed", description: e?.message || "Unable to clear local data", variant: "destructive" });
      } finally {
        setDeleting(false);
      }
    }
  };

  const handlePartnerRemoved = async (requestId: string) => {
    if (!user) {
      toast({ 
        title: "Error", 
        description: "You must be signed in to remove partner requests.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Find the request to determine if it's an accepted partner
      const request = [...outgoing, ...incoming, ...acceptedIncomingPartners].find(req => req.id === requestId);
      const isAcceptedPartner = request?.status === 'accepted';
      
      // Optimistically remove the request from both local states
      setOutgoing(prev => prev.filter(req => req.id !== requestId));
      setIncoming(prev => prev.filter(req => req.id !== requestId));
      setAcceptedIncomingPartners(prev => prev.filter(req => req.id !== requestId));
      
      await deletePartnerRequest(requestId);
      
      if (isAcceptedPartner) {
        toast({ 
          title: "Partner removed", 
          description: "The partnership has been ended." 
        });
        // Notify the parent component about partner removal
        onPartnerRemoved?.(requestId);
      } else {
        toast({ 
          title: "Request removed", 
          description: "The request has been permanently deleted." 
        });
      }
    } catch (error) {
      // On error, restore the correct state by refreshing from subscriptions
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ 
        title: "Error", 
        description: `Failed to remove the partner request: ${errorMessage}`, 
        variant: "destructive" 
      });
    }
  };

  const handlePartnerRequestStatusUpdated = async (requestId: string, status: PartnerRequest["status"]) => {
    if (!user) {
      toast({ 
        title: "Error", 
        description: "You must be signed in to update partner requests.", 
        variant: "destructive" 
      });
      return;
    }

    try {
      // Optimistically update the local state
      setIncoming(prev => prev.map(req => req.id === requestId ? { ...req, status } : req));
      setAcceptedIncomingPartners(prev => prev.map(req => req.id === requestId ? { ...req, status } : req));

      await updatePartnerRequestStatus(requestId, status);

      if (status === 'accepted') {
        toast({ 
          title: "Request accepted", 
          description: "The partner request has been accepted." 
        });
      } else if (status === 'rejected') {
        toast({ 
          title: "Request rejected", 
          description: "The partner request has been rejected." 
        });
      }
    } catch (error) {
      // On error, restore the correct state by refreshing from subscriptions
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({ 
        title: "Error", 
        description: `Failed to update the partner request status: ${errorMessage}`, 
        variant: "destructive" 
      });
    }
  };


  return (
    <div className="space-y-4">
      {/* Trips management - only on Trips tab */}
      {topTab === 'trips' && (
        <TripsManagement onTripsChanged={onTripsChanged} />
      )}

      {/* Currency (hidden on followups) */}
      {topTab !== 'couple' && topTab !== 'followups' && (
        <div>
          <button
            className="w-full text-left text-sm font-medium text-foreground py-2"
            onClick={() => toggle("currency")}
          >
            Currency
          </button>
          <div className={`overflow-hidden transition-[max-height] duration-300 ${open.currency ? 'max-h-[800px]' : 'max-h-0'}`}>
            <div className="pt-2">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Current: {currency ? `${CURRENCIES[currency].symbol} ${currency} - ${CURRENCIES[currency].name}` : "None selected"}
                </div>
                <Select value={currency} onValueChange={onCurrencyChange}>
                  <SelectTrigger className="w-64">
                    <SelectValue>
                      {currency ? `${CURRENCIES[currency].symbol} ${currency}` : "Select currency"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className={`${topTab === 'trips' ? 'max-h-[40vh]' : 'max-h-[60vh]'} overflow-y-auto z-[9999]`} style={{ maxHeight: topTab === 'trips' ? '40vh' : '60vh' }}>
                    {Object.entries(CURRENCIES).map(([code, curr]) => (
                      <SelectItem key={code} value={code}>
                        {curr.symbol} {code} - {curr.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="text-xs text-muted-foreground">
                  Click the dropdown above to select a currency
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage Partners Heading for Couple Tab */}
      {topTab === 'couple' && (
        <div className="pt-2">
          <h3 className="text-lg font-semibold">Manage Partners</h3>
        </div>
      )}

      {/* Manage Follow-ups Heading for Followups Tab */}
      {topTab === 'followups' && (
        <div className="pt-2">
          <h3 className="text-lg font-semibold">Manage Follow-ups</h3>
        </div>
      )}

      <Separator />

      {/* Manage section based on top tab */}
      {topTab === 'couple' ? (
        <div>
          <div className="pt-2">
            <PartnerManagement 
              hideHeader 
              outgoingRequests={outgoing} 
              incomingRequests={incoming}
              acceptedIncomingPartners={acceptedIncomingPartners}
              onPartnerRemoved={handlePartnerRemoved}
              onPartnerRequestStatusUpdated={handlePartnerRequestStatusUpdated}
            />
          </div>
        </div>
      ) : topTab === 'followups' ? (
        <div>
          <div className="pt-2">
            <FollowupsManagement
              hideHeader
              outgoingRequests={outgoingFollowups}
              incomingRequests={incomingFollowups}
              acceptedIncoming={acceptedIncomingFollowups}
              onRemoved={async (id) => {
                try { await deleteFollowupRequest(id); } catch {}
              }}
              onStatusUpdated={async (id, status) => {
                try { await updateFollowupRequestStatus(id, status); } catch {}
              }}
            />
          </div>
        </div>
      ) : (
        <div>
          <button
            className="w-full text-left text-sm font-medium text-foreground py-2"
            onClick={() => toggle("categories")}
          >
            {topTab === 'trips' ? 'Manage Friends' : 'Manage Categories'}
          </button>
          <div className={`overflow-hidden transition-[max-height] duration-300 ${open.categories ? 'max-h-[999px]' : 'max-h-0'}`}>
            <div className="pt-2">
              {topTab === 'trips' ? (
                <ManageFriends onTripsChanged={onTripsChanged} />
              ) : (
                <CategoryManagement hideHeader />
              )}
            </div>
          </div>
        </div>
      )}

      <Separator />

      {/* Import / Export / Delete (Followups: Export only, exporting followed user's data) */}
      {topTab !== 'couple' && (
        <div>
          <button
            className="w-full text-left text-sm font-medium text-foreground py-2"
            onClick={() => toggle("export")}
          >
            {topTab === 'followups' ? 'Export' : 'Import / Export / Delete'}
          </button>
          <div className={`overflow-hidden transition-[max-height] duration-300 ${open.export ? 'max-h-96' : 'max-h-0'}`}>
            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {topTab !== 'followups' && (
                  <>
                    <Button
                      variant="outline"
                      disabled={importing}
                      onClick={() => document.getElementById("dailyspend-import-input")?.click()}
                      className="w-full sm:w-auto px-4"
                    >
                      {topTab === 'trips' ? 'Import Trips' : 'Import'}
                    </Button>
                    <input id="dailyspend-import-input" type="file" accept="text/csv,.csv" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportFile(file);
                    }} />
                    <Button
                      disabled={exporting}
                      onClick={() => handleExport("excel")}
                      className="w-full sm:w-auto bg-primary hover:bg-blue-700 px-4"
                    >
                      {topTab === 'trips' ? 'Export Trips (Excel)' : 'Export (Excel)'}
                    </Button>
                    <Button
                      disabled={exporting}
                      variant="secondary"
                      onClick={() => handleExport("pdf")}
                      className="w-full sm:w-auto px-4"
                    >
                      {topTab === 'trips' ? 'Export Trips (PDF)' : 'Export (PDF)'}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!!user || deleting}
                      onClick={handleDeleteLocalData}
                      title={user ? "Sign out to enable deleting local data" : undefined}
                      className="w-full sm:w-auto px-4"
                    >
                      {topTab === 'trips' ? 'Delete All Trips Data' : 'Delete All Local Data'}
                    </Button>
                  </>
                )}
                {topTab === 'followups' && (
                  <>
                    <Button
                      disabled={exporting}
                      onClick={() => {
                        try {
                          const fd = (window as any).dailyspend_followupData || { categories: [], expenses: [], recurring: [] };
                          // Temporarily override data for export routines
                          (window as any).dailyspend_export_override = fd;
                        } catch {}
                        handleExport("excel");
                      }}
                      className="w-full sm:w-auto bg-primary hover:bg-blue-700 px-4"
                    >
                      Export (Excel)
                    </Button>
                    <Button
                      disabled={exporting}
                      variant="secondary"
                      onClick={() => {
                        try {
                          const fd = (window as any).dailyspend_followupData || { categories: [], expenses: [], recurring: [] };
                          (window as any).dailyspend_export_override = fd;
                        } catch {}
                        handleExport("pdf");
                      }}
                      className="w-full sm:w-auto px-4"
                    >
                      Export (PDF)
                    </Button>
                  </>
                )}
              </div>
              {topTab === 'trips' ? (
                <>
                  <p className="text-xs text-muted-foreground">Export trips data to CSV (open in Excel) or print as PDF. Import accepts the exported trips CSV.</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">⚠️ This will only affect trips data and will NOT change your daily expenses data.</p>
                  {!!user && (
                    <p className="text-xs text-muted-foreground">Delete is only available when no user is signed in.</p>
                  )}
                </>
              ) : topTab === 'followups' ? (
                <>
                  <p className="text-xs text-muted-foreground">Export the followed user's expenses. Data is read-only and matches the junior's own export.</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">Export to CSV (open in Excel) or print as PDF. Import accepts the exported CSV.</p>
                  {!!user && (
                    <p className="text-xs text-muted-foreground">Delete is only available when no user is signed in.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}


    </div>
  );
}


function TripsManagement({ onTripsChanged }: { onTripsChanged?: (hasTrips: boolean) => void }) {
  const { toast } = useToast();
  const [trips, setTrips] = useState<Array<{ id: string; name: string; friends: { name: string }[] }>>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]'); } catch { return []; }
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Add Trip dialog state
  const [addTripOpen, setAddTripOpen] = useState<boolean>(false);
  const [tripNameInput, setTripNameInput] = useState<string>("");
  const [selectedFriendsCount, setSelectedFriendsCount] = useState<number | null>(null);
  const [friendNames, setFriendNames] = useState<string[]>([]);

  useEffect(() => {
    // Refresh on open
    try { setTrips(JSON.parse(localStorage.getItem('dailyspend_trips') || '[]')); } catch {}
    
    // Clean up any orphaned trip data
    cleanupOrphanedTripData();
  }, []);

  const getNextDefaultTripName = () => {
    const trips = getStoredTrips();
    const taken = new Set(trips.map(t => t.name));
    let i = 1;
    while (taken.has(`Trip ${i}`)) i++;
    return `Trip ${i}`;
  };

  const getStoredTrips = () => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]') as Array<{ id: string; name: string; friends: { name: string }[] }>; } catch { return []; }
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
    setTrips(trips);
    onTripsChanged?.(trips.length > 0);
    setAddTripOpen(false);
    resetAddTripState();
  };

  const handleDeleteTrip = async (id: string) => {
    try {
      console.log(`[Trip Delete] Deleting trip with ID: ${id}`);
      
      // Get the trip name for logging
      const tripToDelete = trips.find(t => t.id === id);
      const tripName = tripToDelete?.name || 'Unknown Trip';
      
      // Delete the trip
      const next = trips.filter(t => t.id !== id);
      localStorage.setItem('dailyspend_trips', JSON.stringify(next));
      setTrips(next);
      console.log(`[Trip Delete] Removed trip: ${tripName}`);
      
      // Clean up associated trip expenses
      const tripExpenses = getTripExpensesRaw();
      const expensesToRemove = tripExpenses.filter((expense) => expense.tripId === id);
      const filteredTripExpenses = tripExpenses.filter((expense) => expense.tripId !== id);
      setTripExpensesRaw(filteredTripExpenses);
      console.log(`[Trip Delete] Removed ${expensesToRemove.length} trip expenses for trip: ${tripName}`);
      
      // Clean up associated trip recurring expenses
      const tripRecurring = getTripRecurringRaw();
      const recurringToRemove = tripRecurring.filter((recurring) => recurring.tripId === id);
      const filteredTripRecurring = tripRecurring.filter((recurring) => recurring.tripId !== id);
      setTripRecurringRaw(filteredTripRecurring);
      console.log(`[Trip Delete] Removed ${recurringToRemove.length} trip recurring items for trip: ${tripName}`);
      
      // Trigger immediate upload to Firebase to sync the deletion
      try {
        console.log(`[Trip Delete] Triggering Firebase sync for trip deletion: ${tripName}`);
        window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
      } catch (error) {
        console.error('[Trip Delete] Failed to trigger Firebase sync:', error);
      }
      
      onTripsChanged?.(next.length > 0);
      
      // Show detailed success message
      const totalRemoved = expensesToRemove.length + recurringToRemove.length;
      if (totalRemoved > 0) {
        toast({ 
          title: 'Trip deleted successfully', 
          description: `Removed trip "${tripName}" and ${totalRemoved} associated items` 
        });
      } else {
        toast({ title: 'Trip deleted successfully', description: `Removed trip "${tripName}"` });
      }
      
      console.log(`[Trip Delete] Successfully deleted trip "${tripName}" with ${totalRemoved} associated items`);
    } catch (e) {
      console.error('[Trip Delete] Failed to delete trip:', e);
      toast({ title: 'Delete failed', description: 'Could not delete trip', variant: 'destructive' });
    }
  };

  const promptDeleteTrip = (trip: { id: string; name: string }) => {
    setTripToDelete({ id: trip.id, name: trip.name });
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
        <div>
          <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200">Trips Management</h3>
          <p className="text-sm text-emerald-600 dark:text-emerald-400">Create and manage your trips</p>
        </div>
        <div className="flex gap-2 mt-3">
          <Button 
            size="sm" 
            onClick={() => setAddTripOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-sm w-full"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Trip
          </Button>
        </div>
      </div>
      
      {trips.length === 0 ? (
        <div className="p-6 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 text-center">
          <div className="text-sm text-muted-foreground mb-2">No trips created yet.</div>
          <div className="text-xs text-muted-foreground">Click "Add Trip" to get started</div>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip, index) => (
            <div key={trip.id} className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md dark:hover:shadow-lg dark:hover:shadow-black/20 transition-all duration-200">
              <div className="min-w-0 flex-1">
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
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate text-gray-900 dark:text-gray-100">{trip.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{trip.friends.length} friend{trip.friends.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
              </div>
              <Button 
                variant="destructive" 
                size="icon" 
                title="Delete trip" 
                onClick={() => promptDeleteTrip({ id: trip.id, name: trip.name })}
                className="ml-3 hover:scale-105 transition-transform"
              >
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Trip Dialog */}
      <Dialog open={addTripOpen} onOpenChange={(v) => { setAddTripOpen(v); if (!v) resetAddTripState(); }}>
        <DialogContent className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="text-emerald-800 dark:text-emerald-200">Add a Trip</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <label className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Trip name</label>
              <Input
                value={tripNameInput}
                onChange={(e) => setTripNameInput(e.target.value)}
                placeholder={`e.g. ${getNextDefaultTripName()}`}
                className="mt-2 border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-800"
              />
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Leave empty to use the next available default name.</p>
            </div>
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="text-sm font-medium text-blue-800 dark:text-blue-200">Number of friends to add</label>
              <div className="mt-2 grid grid-cols-5 gap-2">
                {Array.from({ length: 5 }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={selectedFriendsCount === n ? 'default' : 'outline'}
                    className={selectedFriendsCount === n ? 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-sm' : 'border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'}
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
              <div className="p-3 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <label className="text-sm font-medium text-purple-800 dark:text-purple-200">Friend names</label>
                <div className="mt-2 space-y-2">
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
                      className="border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800"
                    />
                  ))}
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">Leave any blank to auto-name as Friend 1, Friend 2, ...</p>
              </div>
            )}
          </div>
          <DialogFooter className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-t border-gray-200 dark:border-gray-700">
            <Button 
              variant="outline" 
              onClick={() => { setAddTripOpen(false); resetAddTripState(); }}
              className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white shadow-sm" 
              onClick={handleCreateTrip} 
              disabled={selectedFriendsCount == null}
            >
              Create Trip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="z-[100] bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 border-gray-200 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-800 dark:text-red-200">Delete Trip</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-700 dark:text-gray-300">
              {`Are you sure you want to delete "${tripToDelete?.name || 'this trip'}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-800 dark:to-slate-800 border-t border-gray-200 dark:border-gray-700">
            <AlertDialogCancel 
              onClick={() => { setDeleteOpen(false); setTripToDelete(null); }}
              className="border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tripToDelete) {
                  handleDeleteTrip(tripToDelete.id);
                }
                setDeleteOpen(false);
                setTripToDelete(null);
              }}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white shadow-sm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ManageFriends({ onTripsChanged }: { onTripsChanged?: (hasTrips: boolean) => void }) {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState<string>("#14B8A6");
  const [customSwatchColor, setCustomSwatchColor] = useState<string>("#000000");
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const [trips, setTrips] = useState<Array<{ id: string; name: string; friends: { name: string }[] }>>(() => {
    try { return JSON.parse(localStorage.getItem('dailyspend_trips') || '[]'); } catch { return []; }
  });
  const [activeTripId, setActiveTripId] = useState<string>(() => (trips[0]?.id || ''));
  const activeTripIndex = trips.findIndex(t => t.id === activeTripId);
  const activeTrip = trips[activeTripIndex] || null;
  const [newFriendName, setNewFriendName] = useState<string>("");

  useEffect(() => {
    try { setTrips(JSON.parse(localStorage.getItem('dailyspend_trips') || '[]')); } catch {}
  }, []);

  const COLOR_OPTIONS = [
    "#14B8A6", // teal
    "#6366F1", // indigo
    "#84CC16", // lime
    "#D946EF", // fuchsia
    "#F97316", // orange
    "#0EA5E9", // sky
    "#F43F5E", // rose
  ];

  const persistTrips = (next: typeof trips) => {
    try { localStorage.setItem('dailyspend_trips', JSON.stringify(next)); } catch {}
    setTrips(next);
    onTripsChanged?.(next.length > 0);
  };

  const addFriend = () => {
    const name = newFriendName.trim() || `Friend ${(activeTrip?.friends.length || 0) + 1}`;
    if (!activeTrip) return;
    const nextTrips = [...trips];
    const t = { ...activeTrip, friends: [...activeTrip.friends, { name }] };
    nextTrips[activeTripIndex] = t;
    persistTrips(nextTrips);
    setNewFriendName("");
    toast({ title: 'Friend added', description: name });
  };

  const removeFriend = (idx: number) => {
    if (!activeTrip) return;
    const confirmed = window.confirm('Remove this friend from the trip?');
    if (!confirmed) return;
    const nextTrips = [...trips];
    const t = { ...activeTrip, friends: activeTrip.friends.filter((_, i) => i !== idx) };
    nextTrips[activeTripIndex] = t;
    persistTrips(nextTrips);
    toast({ title: 'Friend removed' });
  };

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const commitRename = (idx: number) => {
    if (!activeTrip) return;
    const name = editingName.trim();
    if (!name) { setEditingIndex(null); setEditingName(""); return; }
    const nextTrips = [...trips];
    const nextFriends = [...activeTrip.friends];
    nextFriends[idx] = { name };
    nextTrips[activeTripIndex] = { ...activeTrip, friends: nextFriends };
    persistTrips(nextTrips);
    setEditingIndex(null);
    setEditingName("");
    toast({ title: 'Renamed', description: 'Friend name updated' });
  };

  if (!activeTrip) {
    return <div className="text-sm text-muted-foreground">No trips available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Trip</label>
        <Select value={activeTripId} onValueChange={(value) => setActiveTripId(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a trip" />
          </SelectTrigger>
          <SelectContent className="z-[9999]">
            {trips.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Add New Friend */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground/80">Friend Name</label>
        <Input placeholder="e.g., John" value={newFriendName} onChange={(e) => setNewFriendName(e.target.value)} />
        <div>
          <span className="text-sm font-medium text-foreground/80 mb-2 block">Color</span>
          <div className="flex space-x-2 overflow-x-auto pb-4 pt-1 -mx-2 px-2 scrollbar-hide">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex-shrink-0 ${
                  selectedColor === color ? "border-gray-600 scale-105" : "border-transparent hover:border-gray-400"
                }`}
                style={{ backgroundColor: color }}
                onClick={() => setSelectedColor(color)}
              />
            ))}
            <button
              type="button"
              className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex-shrink-0 ${
                selectedColor.toLowerCase() === customSwatchColor.toLowerCase() ? "border-muted-foreground scale-105" : "border-dashed border hover:border-muted-foreground"
              }`}
              style={
                selectedColor.toLowerCase() === customSwatchColor.toLowerCase()
                  ? { backgroundColor: customSwatchColor }
                  : { backgroundImage: 'linear-gradient(90deg, #14B8A6, #6366F1, #84CC16, #D946EF, #F97316, #0EA5E9, #F43F5E)' }
              }
              onClick={() => colorInputRef.current?.click()}
              aria-label="Choose custom color"
              title="Choose custom color"
            />
            <input
              ref={colorInputRef}
              type="color"
              value={customSwatchColor}
              onChange={(e) => {
                setCustomSwatchColor(e.target.value);
                setSelectedColor(e.target.value);
              }}
              className="hidden"
            />
          </div>
        </div>
        <Button className="w-full bg-secondary hover:bg-green-700 text-sm" onClick={addFriend}>
          <Plus className="w-4 h-4 mr-2" />
          Add Friend
        </Button>
      </div>

      {/* Existing Friends */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground/80 mb-3">Existing Friends</h4>
        {(activeTrip.friends.length === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-4">No friends added yet</p>
        ) : (
          activeTrip.friends.map((f, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center min-w-0 flex-1">
                <div className="w-4 h-4 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: COLOR_OPTIONS[idx % COLOR_OPTIONS.length] }} />
                {editingIndex === idx ? (
                  <input
                    className="bg-transparent border-b border-border focus:outline-none text-sm flex-1 min-w-0"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitRename(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(idx);
                      if (e.key === 'Escape') { setEditingIndex(null); setEditingName(''); }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    className="text-left text-sm font-medium text-foreground truncate"
                    onClick={() => { setEditingIndex(idx); setEditingName(f.name || `Friend ${idx+1}`); }}
                    title="Click to rename"
                  >
                    {f.name || `Friend ${idx+1}`}
                  </button>
                )}
              </div>
              <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 text-sm p-1 sm:p-2 flex-shrink-0" onClick={() => removeFriend(idx)}>
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

