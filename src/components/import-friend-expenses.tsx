import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getExpenses, createExpense } from "@/lib/localStorage";
import { formatDate } from "@/lib/date-utils";
import { Expense, Friend } from "@shared/schema";
import { cn } from "@/lib/utils";

interface ImportFriendExpensesProps {
  friend: Friend;
  friendExpenses: Expense[];
  currentDate: string;
  trigger: React.ReactNode;
}

export default function ImportFriendExpenses({ friend, friendExpenses, currentDate, trigger }: ImportFriendExpensesProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [importDate, setImportDate] = useState<Date | undefined>(new Date());
  const [targetDate, setTargetDate] = useState<Date | undefined>(new Date());
  const [isImporting, setIsImporting] = useState(false);

  // Ensure friendExpenses is always an array
  const safeFriendExpenses = Array.isArray(friendExpenses) ? friendExpenses : [];

  const handleImport = async () => {
    if (!importDate || !targetDate) {
      toast({ title: "Select dates", description: "Please select both import and target dates.", variant: "destructive" });
      return;
    }

    const importDateStr = formatDate(importDate);
    const targetDateStr = formatDate(targetDate);
    
    // Filter expenses for the selected import date
    const expensesToImport = safeFriendExpenses.filter(expense => expense.date === importDateStr);
    
    if (expensesToImport.length === 0) {
      toast({ title: "No expenses found", description: `No expenses found for ${importDateStr}.`, variant: "destructive" });
      return;
    }

    try {
      setIsImporting(true);
      
      // Import each expense
      let importedCount = 0;
      for (const expense of expensesToImport) {
        // Create new expense with target date and new ID
        const newExpense = {
          name: expense.name,
          amount: expense.amount,
          details: expense.details || undefined,
          categoryId: expense.categoryId || undefined,
          date: targetDateStr,
        };
        
        await createExpense(newExpense);
        importedCount++;
      }

      toast({ 
        title: "Import successful", 
        description: `Imported ${importedCount} expenses from ${friend.displayName} to ${targetDateStr}.` 
      });
      
      setIsOpen(false);
    } catch (error) {
      console.error('Import error:', error);
      toast({ title: "Import failed", description: "Failed to import expenses. Please try again.", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const getExpenseCountForDate = (date: Date) => {
    const dateStr = formatDate(date);
    return safeFriendExpenses.filter(expense => expense.date === dateStr).length;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import {friend.displayName}'s Expenses</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>From Date (Friend's Data)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !importDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {importDate ? formatDate(importDate) : "Pick a date"}
                  {importDate && (
                    <span className="ml-2 text-sm text-muted-foreground">
                      ({getExpenseCountForDate(importDate)} expenses)
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={importDate}
                  onSelect={setImportDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>To Date (Your Data)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !targetDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? formatDate(targetDate) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {importDate && (
            <div className="text-sm text-muted-foreground">
              {getExpenseCountForDate(importDate)} expenses will be imported from {formatDate(importDate)}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || !importDate || !targetDate}
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              {isImporting ? "Importing..." : "Import Expenses"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
