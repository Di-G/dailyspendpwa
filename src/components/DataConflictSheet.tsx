import React, { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Merge, Download, Upload, Info, CheckCircle, ChevronDown } from "lucide-react";
import { DataConflict, ConflictResolution } from "@/lib/dataConflictResolver";
import { useToast } from "@/hooks/use-toast";

interface DataConflictSheetProps {
  open: boolean;
  onClose: () => void;
  conflict: DataConflict;
  onResolve: (resolution: ConflictResolution) => void;
}

export default function DataConflictSheet({ open, onClose, conflict, onResolve }: DataConflictSheetProps) {
  const { toast } = useToast();
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleResolve = async () => {
    if (!selectedResolution) return;
    
    setIsResolving(true);
    try {
      await onResolve(selectedResolution);
      toast({ 
        title: "Data synchronized", 
        description: "Your data has been successfully synchronized." 
      });
      onClose();
    } catch (error) {
      toast({ 
        title: "Sync failed", 
        description: "Failed to synchronize data. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsResolving(false);
    }
  };

  const getConflictSummary = () => {
    const conflicts = [];
    if (conflict.conflicts.categories) conflicts.push("Categories");
    if (conflict.conflicts.expenses) conflicts.push("Expenses");
    if (conflict.conflicts.recurring) conflicts.push("Recurring Expenses");
    return conflicts.join(", ");
  };

  const getDataCounts = (data: any[], label: string) => {
    const count = data?.length || 0;
    return count > 0 ? `${count} ${label}` : `No ${label}`;
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent 
        side="bottom" 
        className={`transition-all duration-300 ease-in-out ${
          isExpanded ? 'h-[95vh]' : 'h-[70vh]'
        } overflow-y-auto`}
      >
        {/* Draggable Handle */}
        <div className="flex justify-center pb-2">
          <button
            onClick={toggleExpanded}
            className="w-12 h-1.5 bg-muted-foreground/30 rounded-full hover:bg-muted-foreground/50 transition-colors cursor-pointer"
            aria-label={isExpanded ? "Collapse sheet" : "Expand sheet"}
          >
            <ChevronDown 
              className={`w-4 h-4 mx-auto transition-transform duration-300 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Data Synchronization Required
          </SheetTitle>
          <SheetDescription className="text-sm">
            We found different data in your local storage and online account. 
            Please choose how you'd like to handle this conflict.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4 overflow-y-auto max-h-[calc(100vh-200px)]">
          {/* Scroll Indicator */}
          <div className="flex justify-center pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-pulse"></div>
              <span>Scroll down to see action buttons</span>
              <div className="w-1 h-1 bg-muted-foreground/50 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Conflict Summary */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Conflict Summary</AlertTitle>
            <AlertDescription>
              Conflicts detected in: <strong>{getConflictSummary()}</strong>
            </AlertDescription>
          </Alert>

          {/* Data Comparison - Compact Layout */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Data Comparison</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Local:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.localData.categories, "cat")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Expenses:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.localData.expenses, "exp")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recurring:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.localData.recurring, "rec")}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Online:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.onlineData.categories, "cat")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Expenses:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.onlineData.expenses, "exp")}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Recurring:</span>
                  <Badge variant="secondary" className="text-xs">
                    {getDataCounts(conflict.onlineData.recurring, "rec")}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Resolution Options - Compact Cards */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Choose Resolution Method:</h4>
            
            <div className="space-y-2">
              <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="resolution"
                  value="merge"
                  checked={selectedResolution === 'merge'}
                  onChange={() => setSelectedResolution('merge')}
                  className="h-4 w-4 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Merge className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    <span className="font-medium text-sm">Merge Data (Recommended)</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Combine local and online data, keeping the most recent version of each item.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="resolution"
                  value="overwrite-online"
                  checked={selectedResolution === 'overwrite-online'}
                  onChange={() => setSelectedResolution('overwrite-online')}
                  className="h-4 w-4 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Upload className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="font-medium text-sm">Use Local Data</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload your local data to the cloud, completely replacing online data.
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="radio"
                  name="resolution"
                  value="overwrite-local"
                  checked={selectedResolution === 'overwrite-local'}
                  onChange={() => setSelectedResolution('overwrite-local')}
                  className="h-4 w-4 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Download className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    <span className="font-medium text-sm">Use Online Data</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Download online data, replacing your local data.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning for data loss - Always below Use Online Data option */}
          {selectedResolution === 'overwrite-local' && (
            <Alert variant="destructive" className="text-sm">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Local Data Will Be Lost</AlertTitle>
              <AlertDescription>
                This action will permanently replace your local data with online data. 
                Any local changes not yet synced will be lost forever.
              </AlertDescription>
            </Alert>
          )}

          {/* Warning for online data loss - Always below Use Local Data option */}
          {selectedResolution === 'overwrite-online' && (
            <Alert variant="destructive" className="text-sm">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning: Online Data Will Be Lost</AlertTitle>
              <AlertDescription>
                This action will completely replace all online data with your local data. 
                Any online data not present in your local storage will be permanently lost.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons - Always below the warning and part of scrollable content */}
          <div className="pt-4 border-t">
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={onClose} 
                disabled={isResolving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleResolve} 
                disabled={!selectedResolution || isResolving}
                className="flex-1"
              >
                {isResolving ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2 animate-pulse" />
                    Syncing...
                  </>
                ) : (
                  "Sync Data"
                )}
              </Button>
            </div>
          </div>

          {/* Bottom Spacing */}
          <div className="h-4"></div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
