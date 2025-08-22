import { useEffect, useMemo, useRef, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CategoryManagement from "@/components/category-management";
import PartnerManagement from "@/components/partner-management";
import { useToast } from "@/hooks/use-toast";
import { getExpenses, getCategories, updateAllData, initializeDefaultCategories, getTripExpensesRaw, setTripExpensesRaw, getTripRecurringRaw, setTripRecurringRaw } from "@/lib/localStorage";
import { useAuth } from "@/lib/auth";
import { subscribeToIncomingRequests, subscribeToOutgoingRequests, updatePartnerRequestStatus, deletePartnerRequest, subscribeToAcceptedIncomingPartners, type PartnerRequest } from "@/lib/sync";
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

  useEffect(() => {
    let stopOut: null | (() => void) = null;
    let stopIn: null | (() => void) = null;
    let stopAcceptedIncoming: null | (() => void) = null;
    if (user) {
      stopOut = subscribeToOutgoingRequests(user.uid, setOutgoing);
      stopIn = subscribeToIncomingRequests(user.uid, setIncoming);
      stopAcceptedIncoming = subscribeToAcceptedIncomingPartners(user.uid, setAcceptedIncomingPartners);
    }
    return () => {
      try { stopOut?.(); } catch {}
      try { stopIn?.(); } catch {}
      try { stopAcceptedIncoming?.(); } catch {}
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
        const csv = buildCsv();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `daily-spends-export-${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Exported", description: "Data exported as CSV (openable in Excel)" });
      } else {
        // Minimal PDF generation: open formatted HTML in new tab and let user save as PDF
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

      {/* Currency */}
      {topTab !== 'couple' && (
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
                  <SelectContent className="max-h-60 overflow-y-auto z-[9999]">
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

      <Separator />

      {/* Manage Friends (Trips) or Categories based on top tab */}
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

      {/* Import / Export / Delete */}
      {topTab !== 'couple' && (
        <div>
          <button
            className="w-full text-left text-sm font-medium text-foreground py-2"
            onClick={() => toggle("export")}
          >
            Import / Export / Delete
          </button>
          <div className={`overflow-hidden transition-[max-height] duration-300 ${open.export ? 'max-h-96' : 'max-h-0'}`}>
            <div className="pt-2 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  variant="outline"
                  disabled={importing}
                  onClick={() => document.getElementById("dailyspend-import-input")?.click()}
                  className="w-full sm:w-auto px-4"
                >
                  Import
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
                  Export (Excel)
                </Button>
                <Button
                  disabled={exporting}
                  variant="secondary"
                  onClick={() => handleExport("pdf")}
                  className="w-full sm:w-auto px-4"
                >
                  Export (PDF)
                </Button>
                <Button
                  variant="destructive"
                  disabled={!!user || deleting}
                  onClick={handleDeleteLocalData}
                  title={user ? "Sign out to enable deleting local data" : undefined}
                  className="w-full sm:w-auto px-4"
                >
                  Delete All Local Data
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Export to CSV (open in Excel) or print as PDF. Import accepts the exported CSV.</p>
              {!!user && (
                <p className="text-xs text-muted-foreground">Delete is only available when no user is signed in.</p>
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
      // Delete the trip
      const next = trips.filter(t => t.id !== id);
      localStorage.setItem('dailyspend_trips', JSON.stringify(next));
      setTrips(next);
      
      // Clean up associated trip expenses
      const tripExpenses = getTripExpensesRaw();
      const filteredTripExpenses = tripExpenses.filter((expense) => expense.tripId !== id);
      setTripExpensesRaw(filteredTripExpenses);
      
      // Clean up associated trip recurring expenses
      const tripRecurring = getTripRecurringRaw();
      const filteredTripRecurring = tripRecurring.filter((recurring) => recurring.tripId !== id);
      setTripRecurringRaw(filteredTripRecurring);
      
      // Trigger immediate upload to Firebase
      try {
        window.dispatchEvent(new CustomEvent('dailyspend:force-upload-trips'));
      } catch (error) {
        console.error('Failed to trigger immediate upload:', error);
      }
      
      onTripsChanged?.(next.length > 0);
      toast({ title: 'Trip deleted' });
    } catch (e) {
      toast({ title: 'Delete failed', description: 'Could not delete trip', variant: 'destructive' });
    }
  };

  const promptDeleteTrip = (trip: { id: string; name: string }) => {
    setTripToDelete({ id: trip.id, name: trip.name });
    setDeleteOpen(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Trips</h3>
        <Button 
          size="sm" 
          onClick={() => setAddTripOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Trip
        </Button>
      </div>
      
      {trips.length === 0 ? (
        <div className="p-3 border rounded-md">
          <div className="text-sm text-muted-foreground">No trips created yet.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {trips.map(trip => (
            <div key={trip.id} className="flex items-center justify-between p-2 border rounded-md bg-card">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{trip.name}</div>
                <div className="text-xs text-muted-foreground truncate">{trip.friends.length} friend{trip.friends.length === 1 ? '' : 's'}</div>
              </div>
              <Button variant="destructive" size="icon" title="Delete trip" onClick={() => promptDeleteTrip({ id: trip.id, name: trip.name })}>
                <Trash className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Trip Dialog */}
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

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="z-[100]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Trip</AlertDialogTitle>
            <AlertDialogDescription>
              {`Are you sure you want to delete "${tripToDelete?.name || 'this trip'}"? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteOpen(false); setTripToDelete(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (tripToDelete) {
                  handleDeleteTrip(tripToDelete.id);
                }
                setDeleteOpen(false);
                setTripToDelete(null);
              }}
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
        <select
          className="border rounded-md h-8 px-2 bg-background"
          value={activeTripId}
          onChange={(e) => setActiveTripId(e.target.value)}
        >
          {trips.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
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

