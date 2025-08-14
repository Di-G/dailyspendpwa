import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, CheckCircle2, LogOut, MailCheck, KeyRound, Pencil } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Profile() {
  const { user, isVerified, displayName, setDisplayName, emailForSignIn, setEmailForSignIn, saveDisplayName, signOutUser, signUpWithEmailPassword, signInWithEmailPassword, sendVerificationEmail, sendPasswordReset, refreshUser } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [infoMessage, setInfoMessage] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  const handleAuth = async () => {
    if (!emailForSignIn || !password) {
      toast({ title: "Email and password required", description: "Please fill both fields.", variant: "destructive" });
      return;
    }
    try {
      setIsSending(true);
      if (mode === "signup") {
        await signUpWithEmailPassword(emailForSignIn, password);
        const msg = "We sent a verification email. Please verify to unlock features. If you don't see it, check Spam/Promotions.";
        setInfoMessage(msg);
      } else {
        await signInWithEmailPassword(emailForSignIn, password);
      }
    } catch (e: any) {
      toast({ title: "Authentication failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSending(false);
    }
  };

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
    setPassword("");
  };

  const handleSendVerify = async () => {
    try {
      await sendVerificationEmail();
      const msg = "Verification email sent. Check your inbox. If you don't see it, check Spam/Promotions.";
      setInfoMessage(msg);
    } catch (e: any) {
      toast({ title: "Failed to send verification", description: e?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleForgotPassword = async () => {
    if (!emailForSignIn) {
      toast({ title: "Email required", description: "Enter your email first.", variant: "destructive" });
      return;
    }
    try {
      await sendPasswordReset(emailForSignIn);
      const msg = "Password reset email sent. Check your inbox. If you don't see it, check Spam/Promotions.";
      setInfoMessage(msg);
    } catch (e: any) {
      toast({ title: "Failed to send reset", description: e?.message || "Please try again.", variant: "destructive" });
    }
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
            <SheetTitle className="flex items-center gap-2">
              Profile
              {isVerified && (
                <Badge variant="secondary" className="flex items-center gap-1 bg-green-600 text-white">
                  <CheckCircle2 className="w-4 h-4 text-white" /> Verified
                </Badge>
              )}
            </SheetTitle>
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
                    {isVerified && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="icon" aria-label="Edit name" onClick={() => setIsEditingName(true)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {!user ? (
              <>
                {mode === "signup" && (
                  <>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <Input
                      placeholder="Your name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                    />
                  </>
                )}
                <label className="text-sm text-muted-foreground">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={emailForSignIn}
                  onChange={(e) => setEmailForSignIn(e.target.value)}
                />
                <label className="text-sm text-muted-foreground">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />

                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={handleAuth} disabled={!emailForSignIn || !password || isSending}>
                    {mode === "signup" ? "Sign up" : "Sign in"}
                  </Button>
                  <Button variant="outline" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}> 
                    {mode === "signup" ? "Have an account? Sign in" : "New here? Sign up"}
                  </Button>
                  <Button variant="ghost" onClick={handleForgotPassword}>
                    <KeyRound className="w-4 h-4 mr-1" /> Forgot password
                  </Button>
                </div>

                {infoMessage && (
                  <Alert className="mt-2">
                    <MailCheck className="h-4 w-4" />
                    <AlertTitle>Status</AlertTitle>
                    <AlertDescription>{infoMessage}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Signed in as {displayName || user.displayName || "user"} with email {user.email}</p>
                <div>
                  <Button variant="outline" onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" /> Sign out
                  </Button>
                </div>
                {!isVerified && (
                  <div className="space-y-2">
                    <p className="text-sm">To use pro features you need to verify your email address.</p>
                    {infoMessage && (
                      <Alert>
                        <MailCheck className="h-4 w-4" />
                        <AlertTitle>Status</AlertTitle>
                        <AlertDescription>{infoMessage}</AlertDescription>
                      </Alert>
                    )}
                    <div className="flex flex-col gap-2">
                      <Button variant="outline" onClick={handleSendVerify}>
                        <MailCheck className="w-4 h-4 mr-1" /> Send verification email
                      </Button>
                      <Button variant="ghost" onClick={refreshUser}>I've verified, refresh</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {user && isVerified ? (
            <Alert className="mt-2">
              <MailCheck className="h-4 w-4" />
              <AlertTitle>Status</AlertTitle>
              <AlertDescription>
                Your data is now syncing securely to our servers. Any entry you add or edit is uploaded instantly.
                Sign in with this email on any device to access your data automatically.
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}


