import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Upload, Info, Cloud } from "lucide-react";
import { getCategories, getExpenses, getRecurringExpenses, getFriends } from "@/lib/localStorage";

interface DataUploadPromptProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  userId: string;
}

export default function DataUploadPrompt({ open, onClose, onUpload, userId }: DataUploadPromptProps) {
  const localData = {
    categories: getCategories(userId),
    expenses: getExpenses(userId),
    recurring: getRecurringExpenses(userId),
    friends: getFriends(userId)
  };

  const getDataCounts = (data: any[], label: string) => {
    const count = data?.length || 0;
    return count > 0 ? `${count} ${label}` : `No ${label}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            Upload Your Data to Cloud
          </DialogTitle>
          <DialogDescription>
            We found data on your device but no data in your online account. 
            Would you like to upload your local data to sync it with the cloud?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Local Data Found</AlertTitle>
            <AlertDescription>
              Your device contains the following data that can be uploaded to the cloud:
            </AlertDescription>
          </Alert>

          {/* Data Summary */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm text-muted-foreground">Data on Your Device:</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Categories:</span>
                <Badge variant="secondary">
                  {getDataCounts(localData.categories, "categories")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Expenses:</span>
                <Badge variant="secondary">
                  {getDataCounts(localData.expenses, "expenses")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Recurring:</span>
                <Badge variant="secondary">
                  {getDataCounts(localData.recurring, "recurring expenses")}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Friends:</span>
                <Badge variant="secondary">
                  {getDataCounts(localData.friends, "friends")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Benefits of Uploading:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Access your data from any device</li>
              <li>• Automatic backup and recovery</li>
              <li>• Sync across multiple devices</li>
              <li>• Never lose your data</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onUpload} className="min-w-[100px]">
            <Upload className="h-4 w-4 mr-2" />
            Upload to Cloud
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
