import { useState, useMemo } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import CategoryManagement from "@/components/category-management";
import { useToast } from "@/hooks/use-toast";
import { getExpenses, getCategories } from "@/lib/localStorage";

type CurrencyCode = "USD" | "INR";

const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  INR: { symbol: "₹", name: "Indian Rupee" },
} as const;

interface SettingsDrawerProps {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
}

export default function SettingsDrawer({ currency, setCurrency }: SettingsDrawerProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState<{
    currency: boolean;
    categories: boolean;
    export: boolean;
  }>({ currency: false, categories: false, export: false });

  // Persist currency preference
  const onCurrencyChange = (value: string) => {
    const next = (value as CurrencyCode);
    localStorage.setItem("dailyspend_currency", next);
    setCurrency(next);
    toast({ title: "Currency updated", description: `Now using ${next}` });
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

  return (
    <div className="space-y-4">
      {/* Currency */}
      <div>
        <button
          className="w-full text-left text-sm font-medium text-gray-900 py-2"
          onClick={() => toggle("currency")}
        >
          Currency
        </button>
        <div className={`overflow-hidden transition-[max-height] duration-300 ${open.currency ? 'max-h-96' : 'max-h-0'}`}>
          <div className="pt-2">
            <Select value={currency} onValueChange={onCurrencyChange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CURRENCIES).map(([code, curr]) => (
                  <SelectItem key={code} value={code}>
                    {curr.symbol} {code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Manage Categories */}
      <div>
        <button
          className="w-full text-left text-sm font-medium text-gray-900 py-2"
          onClick={() => toggle("categories")}
        >
          Manage Categories
        </button>
        <div className={`overflow-hidden transition-[max-height] duration-300 ${open.categories ? 'max-h-[999px]' : 'max-h-0'}`}>
          <div className="pt-2">
            <CategoryManagement hideHeader />
          </div>
        </div>
      </div>

      <Separator />

      {/* Export / Import */}
      <div>
        <button
          className="w-full text-left text-sm font-medium text-gray-900 py-2"
          onClick={() => toggle("export")}
        >
          Export / Import
        </button>
        <div className={`overflow-hidden transition-[max-height] duration-300 ${open.export ? 'max-h-96' : 'max-h-0'}`}>
          <div className="pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
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
            </div>
            <p className="text-xs text-gray-500">Export to CSV (open in Excel) or print as PDF. Import accepts the exported CSV.</p>
          </div>
        </div>
      </div>
    </div>
  );
}


