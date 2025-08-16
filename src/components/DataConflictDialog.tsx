import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Merge, Download, Upload, Info } from "lucide-react";
import { DataConflict, ConflictResolution } from "@/lib/dataConflictResolver";
import { useToast } from "@/hooks/use-toast";

interface DataConflictDialogProps {
  open: boolean;
  onClose: () => void;
  conflict: DataConflict;
  onResolve: (resolution: ConflictResolution) => void;
}

export default function DataConflictDialog({ open, onClose, conflict, onResolve }: DataConflictDialogProps) {
  const { toast } = useToast();
  const [selectedResolution, setSelectedResolution] = useState<ConflictResolution | null>(null);
  const [isResolving, setIsResolving] = useState(false);

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
    if (conflict.conflicts.friends) conflicts.push("Friends");
    return conflicts.join(", ");
  };

  const getDataCounts = (data: any[], label: string) => {
    const count = data?.length || 0;
    return count > 0 ? `${count} ${label}` : `No ${label}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Data Synchronization Required
          </DialogTitle>
          <DialogDescription>
            We found different data in your local storage and online account. 
            Please choose how you'd like to handle this conflict.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Categories:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.categories, "categories")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expenses:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.expenses, "expenses")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recurring:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.recurring, "recurring expenses")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Friends:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.localData.friends, "friends")}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-muted-foreground">Online Data</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Categories:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.categories, "categories")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Expenses:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.expenses, "expenses")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recurring:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.recurring, "recurring expenses")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Friends:</span>
                    <Badge variant="secondary">
                      {getDataCounts(conflict.onlineData.friends, "friends")}
                    </Badge>
                  </div>
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
                      Combine local and online data, keeping the most recent version of each item.
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
                      Upload your local data to the cloud, completely replacing online data.
                    </p>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
                  <input
                    type="radio"
                    name="resolution"
                    value="replace-local-with-online"
                    checked={selectedResolution === 'replace-local-with-online'}
                    onChange={() => setSelectedResolution('replace-local-with-online')}
                    className="h-4 w-4"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Download className="h-4 w-4 text-orange-500" />
                      <span className="font-medium">Use Online Data</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Download online data, replacing your local data.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Warning for data loss */}
            {selectedResolution === 'replace-local-with-online' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Local Data Will Be Permanently Lost</AlertTitle>
                <AlertDescription>
                  This action will permanently remove all local data from your mobile device and replace it with online data. 
                  Any local changes not yet synced will be lost forever.
                </AlertDescription>
              </Alert>
            )}

            {/* Warning for online data loss */}
            {selectedResolution === 'overwrite-online' && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Warning: Online Data Will Be Permanently Lost</AlertTitle>
                <AlertDescription>
                  This action will completely replace all online data with your local data. 
                  Any online data not present in your local storage will be permanently lost from the server.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isResolving}>
            Cancel
          </Button>
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
