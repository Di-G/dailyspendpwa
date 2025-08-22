import React, { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Merge, Download, Upload, Info } from "lucide-react";
import { DataConflict, ConflictResolution } from "@/lib/dataConflictResolver";
import { useToast } from "@/hooks/use-toast";

interface DataConflictDialogProps {
  open: boolean;
  onClose: () => void;
  conflict: DataConflict;
  onResolve: (resolution: ConflictResolution) => Promise<void>;
  titleOverride?: string;
  sectionsLabelOverride?: {
    categories?: string;
    expenses?: string;
    recurring?: string;
  };
  descriptionOverride?: string;
  allowOutsideClick?: boolean; // Allow clicking outside to close (for trips conflicts)
}

export default function DataConflictDialog({ open, onClose, conflict, onResolve, titleOverride, sectionsLabelOverride, descriptionOverride, allowOutsideClick = false }: DataConflictDialogProps) {
  const { toast } = useToast();
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const suppressOnCloseRef = useRef(false);

  const handleResolve = async () => {
    if (!selectedResolution) return;
    
    setIsResolving(true);
    suppressOnCloseRef.current = true; // prevent logout when dialog closes due to successful resolution
    try {
      await onResolve(selectedResolution);
      toast({ 
        title: "Data synchronized", 
        description: "Your data has been successfully synchronized." 
      });
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
    if (conflict.conflicts.categories) conflicts.push(sectionsLabelOverride?.categories || "Categories");
    if (conflict.conflicts.expenses) conflicts.push(sectionsLabelOverride?.expenses || "Expenses");
    if (conflict.conflicts.recurring) conflicts.push(sectionsLabelOverride?.recurring || "Recurring Expenses");
    return conflicts.join(", ");
  };

  const getDataCounts = (data: any[], label: string) => {
    const count = data?.length || 0;
    
    // Check if this is trips data by examining the data structure
    const isTripsData = data && data.length > 0 && data[0] && (
      // Check if it's trips array (has name and friends properties)
      (data[0].name && Array.isArray(data[0].friends)) ||
      // Check if it's trip expenses (has tripId property)
      (data[0].tripId && data[0].name && data[0].amount) ||
      // Check if it's trip recurring (has tripId and frequency properties)
      (data[0].tripId && data[0].frequency)
    );
    
    // Special handling for trips data to show trip names
    if (isTripsData && count > 0) {
      if (data[0].name && Array.isArray(data[0].friends)) {
        // This is trips array
        const tripNames = data.map((trip: any) => trip.name || 'Unnamed Trip').join(', ');
        if (count === 1) {
          return `1 Trip (${tripNames})`;
        } else {
          return `${count} Trips (${tripNames})`;
        }
      } else if (data[0].tripId && data[0].name) {
        // This is trip expenses or recurring
        const uniqueTripIds = [...new Set(data.map((item: any) => item.tripId))];
        if (uniqueTripIds.length === 1) {
          return `${count} items for 1 trip`;
        } else {
          return `${count} items for ${uniqueTripIds.length} trips`;
        }
      }
    }
    
    // Default handling for regular data
    return count > 0 ? `${count} ${label}` : `No ${label}`;
  };

  const getTripsDetailedInfo = (data: any[]) => {
    if (!data || data.length === 0) return null;
    
    // Check if this is trips data
    const isTripsData = data[0] && (
      (data[0].name && Array.isArray(data[0].friends)) ||
      (data[0].tripId && data[0].name && data[0].amount) ||
      (data[0].tripId && data[0].frequency)
    );
    
    if (!isTripsData) return null;
    
    if (data[0].name && Array.isArray(data[0].friends)) {
      // This is trips array - show trip names and friend counts
      return (
        <div className="mt-2 space-y-1">
          {data.map((trip: any, index: number) => (
            <div key={index} className="text-xs text-muted-foreground flex items-center gap-2">
              <span>• {trip.name || 'Unnamed Trip'}</span>
              <span className="text-xs opacity-70">({trip.friends?.length || 0} friends)</span>
            </div>
          ))}
        </div>
      );
    }
    
    return null;
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (nextOpen) {
        suppressOnCloseRef.current = false;
        return;
      }
      if (!nextOpen) {
        if (suppressOnCloseRef.current) return;
        onClose();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => allowOutsideClick ? undefined : e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {titleOverride || 'Data Synchronization Required'}
          </DialogTitle>
          <DialogDescription>
            {descriptionOverride || 'We found different data in your local storage and online account. Please choose how you\'d like to handle this conflict.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Conflict Summary */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Conflict Summary</AlertTitle>
            <AlertDescription>
              Conflicts detected in: <strong>{getConflictSummary()}</strong>
            </AlertDescription>
          </Alert>

          {/* Data Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Local Data</h4>
              <div className="space-y-2">
                {conflict.conflicts.categories && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.categories || 'Categories'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.categories, "categories")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.categories && getTripsDetailedInfo(conflict.localData.categories)}
                {conflict.conflicts.expenses && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.expenses || 'Expenses'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.expenses, "expenses")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.expenses && getTripsDetailedInfo(conflict.localData.expenses)}
                {conflict.conflicts.recurring && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.recurring || 'Recurring'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.recurring, "recurring expenses")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.recurring && getTripsDetailedInfo(conflict.localData.recurring)}
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-muted-foreground">Online Data</h4>
              <div className="space-y-2">
                {conflict.conflicts.categories && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.categories || 'Categories'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.categories, "categories")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.categories && getTripsDetailedInfo(conflict.onlineData.categories)}
                {conflict.conflicts.expenses && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.expenses || 'Expenses'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.expenses, "expenses")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.expenses && getTripsDetailedInfo(conflict.onlineData.expenses)}
                {conflict.conflicts.recurring && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{sectionsLabelOverride?.recurring || 'Recurring'}:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.recurring, "recurring expenses")}
                    </Badge>
                  </div>
                )}
                {conflict.conflicts.recurring && getTripsDetailedInfo(conflict.onlineData.recurring)}
              </div>
            </div>
          </div>

          {/* Resolution Options */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Choose Resolution Method:</h4>
            
            <div className="space-y-2">
              <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="resolution"
                  value="merge"
                  checked={selectedResolution === 'merge'}
                  onChange={() => setSelectedResolution('merge')}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Merge className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">Merge Data (Recommended)</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Push your entries made when you were offline to cloud. This combines both your local and cloud entries together.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="resolution"
                  value="overwrite-online"
                  checked={selectedResolution === 'overwrite-online'}
                  onChange={() => setSelectedResolution('overwrite-online')}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-green-500" />
                    <span className="font-medium">Use Local Data</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Upload your local data to the cloud, entirely overwriting online data.
                  </p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                <input
                  type="radio"
                  name="resolution"
                  value="overwrite-local"
                  checked={selectedResolution === 'overwrite-local'}
                  onChange={() => setSelectedResolution('overwrite-local')}
                  className="h-4 w-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Download className="h-4 w-4 text-orange-500" />
                    <span className="font-medium">Use Online Data</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Download online data, entirely replacing your local data.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Warning for data loss */}
          {selectedResolution === 'overwrite-online' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You will lose all your online data.
              </AlertDescription>
            </Alert>
          )}

          {selectedResolution === 'overwrite-local' && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                You will lose all your local data (entries made when you were offline).
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button 
            onClick={handleResolve} 
            disabled={!selectedResolution || isResolving}
            className="min-w-[100px]"
          >
            {isResolving ? "Syncing..." : "Sync Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
