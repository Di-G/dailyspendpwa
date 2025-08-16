import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, LogOut, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, displayName, setDisplayName, saveDisplayName, signOutUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  const handleSaveName = async () => {
    try {
      setIsSaving(true);
      await saveDisplayName();
    } catch (e: any) {
      toast({ title: "Failed to save name", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
      setIsEditingName(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    // Stay on the profile sheet; do not close
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Profile">
          <User className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-card p-0 flex flex-col w-full sm:w-[420px]">
        <div className="p-6 border-b border">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">Profile</SheetTitle>
          </SheetHeader>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {user && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">Name</label>
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Your name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                  <Button onClick={handleSaveName} disabled={!displayName || isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{displayName || user.displayName || "Your name"}</span>
                  </div>
                  <Button variant="outline" size="icon" aria-label="Edit name" onClick={() => setIsEditingName(true)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {user ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Signed in as {displayName || user.displayName || "user"} with email {user.email}</p>
                <div>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </Button>
                </div>
              </div>
            )}
          </div>

          {null}
        </div>
      </SheetContent>
    </Sheet>
  );
}


