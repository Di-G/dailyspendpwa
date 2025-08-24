import { useState, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { findVerifiedUserByEmail, createFollowupRequest, type FollowupRequest, updateFollowupRequestStatus, deleteFollowupRequest } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Check, X } from "lucide-react";

export interface FollowupsManagementHandle {
  openAdd: () => void;
}

interface FollowupsManagementProps {
  hideHeader?: boolean;
  outgoingRequests: FollowupRequest[];
  incomingRequests?: FollowupRequest[];
  acceptedIncoming?: FollowupRequest[];
  onRemoved?: (requestId: string) => void;
  onStatusUpdated?: (requestId: string, status: FollowupRequest["status"]) => void;
}

export default forwardRef<FollowupsManagementHandle, FollowupsManagementProps>(function FollowupsManagement({ hideHeader, outgoingRequests, incomingRequests = [], acceptedIncoming = [], onRemoved, onStatusUpdated }: FollowupsManagementProps, ref) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const { user, isVerified } = useAuth();
  const { toast } = useToast();

  const handleOpenAdd = () => {
    if (!isVerified) {
      setSubmitMessage("This functionality is only available to verified users. Please verify your email in Profile.");
      setAddOpen(true);
      return;
    }
    setSubmitMessage("Enter the user's name and email. The user must be verified.");
    setAddOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitMessage("");
    const finalName = name.trim();
    const finalEmail = email.trim();
    if (!finalName || !finalEmail) {
      setSubmitMessage("Please enter both name and email address.");
      return;
    }
    if (finalEmail.toLowerCase() === (user.email || "").toLowerCase()) {
      setSubmitMessage("You cannot add yourself.");
      return;
    }
    setSubmitLoading(true);
    try {
      const found = await findVerifiedUserByEmail(finalEmail);
      if (!found) {
        setSubmitMessage("No verified user found with that email.");
        return;
      }
      await createFollowupRequest({
        fromUid: user.uid,
        fromEmail: user.email || "",
        fromName: user.displayName || "",
        toUid: found.uid,
        toEmail: found.email,
        toName: finalName,
      });
      setName("");
      setEmail("");
      setAddOpen(false);
      toast({ title: "Follow-up request sent", description: "The user will receive a notification to accept." });
    } catch (e) {
      setSubmitMessage("Failed to send request. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const removeRequest = async (requestId: string) => {
    if (removing) return;
    setRemoving(true);
    try {
      await deleteFollowupRequest(requestId);
      onRemoved?.(requestId);
      toast({ title: "Request removed", description: "The follow-up request has been deleted." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to remove request", variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const acceptIncoming = async (req: FollowupRequest) => {
    try {
      onStatusUpdated?.(req.id, "accepted");
      await updateFollowupRequestStatus(req.id, "accepted");
      toast({ title: "Request accepted" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to accept", variant: "destructive" });
    }
  };
  const rejectIncoming = async (req: FollowupRequest) => {
    try {
      onStatusUpdated?.(req.id, "rejected");
      await updateFollowupRequestStatus(req.id, "rejected");
      toast({ title: "Request rejected" });
    } catch (e) {
      toast({ title: "Error", description: "Failed to reject", variant: "destructive" });
    }
  };

  useImperativeHandle(ref, () => ({
    openAdd: () => setAddOpen(true),
  }), []);

  const pending = outgoingRequests.filter(r => r.status === 'pending');
  const accepted = outgoingRequests.filter(r => r.status === 'accepted');
  const rejected = outgoingRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled');

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-950/20 dark:to-amber-950/20 border-yellow-200 dark:border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <span className="text-yellow-600 dark:text-yellow-400 mr-2">👀</span>
                Manage Follow-ups
              </h3>
              <Button onClick={handleOpenAdd} size="sm" className="bg-yellow-500 hover:bg-yellow-600 text-white shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a User to Follow</DialogTitle>
          </DialogHeader>
          {!!submitMessage && (
            <Alert className="mb-2">
              <AlertTitle>Status</AlertTitle>
              <AlertDescription>{submitMessage}</AlertDescription>
            </Alert>
          )}
          {isVerified && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter user's name" />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter user's email" type="email" />
              </div>
              <p className="text-xs text-muted-foreground">The user must be verified for you to follow them.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            {isVerified && (
              <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? "Sending..." : "Send Request"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Your expenses are being tracked by */}
      {acceptedIncoming.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <h4 className="text-base font-medium text-indigo-700 dark:text-indigo-300">Your expenses are being tracked by</h4>
          </div>
          <div className="pl-4 space-y-3">
            {acceptedIncoming.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-indigo-200 rounded-lg bg-indigo-50 dark:bg-indigo-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-sm font-medium">{request.fromName || request.fromEmail}</div>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400">Can view your expenses</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRequest(request.id)}
                  disabled={removing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                  title="Remove access"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tracking daily expenses of */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <h4 className="text-base font-medium text-green-700 dark:text-green-300">Tracking daily expenses of</h4>
        </div>
        {accepted.length > 0 ? (
          <div className="pl-4 space-y-3">
            {accepted.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">You are viewing their expenses</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRequest(request.id)}
                  disabled={removing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="pt-3">
              <p className="text-xs text-muted-foreground mb-2">Add a user to track their expenses</p>
              <Button onClick={handleOpenAdd} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                Add a follow-up
              </Button>
            </div>
          </div>
        ) : (
          <div className="pl-4 py-4 text-center">
            <p className="text-sm font-medium text-foreground mb-1">None</p>
            <p className="text-xs text-muted-foreground mb-3">Add a user to track their expenses</p>
            <Button onClick={handleOpenAdd} className="w-full bg-yellow-500 hover:bg-yellow-600 text-white shadow-md">
              <Plus className="w-4 h-4 mr-2" />
              Add a follow-up
            </Button>
          </div>
        )}
      </div>

      {/* Rejected/Cancelled Requests */}
      {rejected.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <h4 className="text-base font-medium text-red-700 dark:text-red-300">Rejected/Cancelled Requests</h4>
          </div>
          <div className="pl-4 space-y-3">
            {rejected.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {request.status === 'rejected' ? 'Request rejected' : 'Request cancelled'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRequest(request.id)}
                  disabled={removing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                  title="Remove from list"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-up Requests */}
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h4 className="text-base font-medium text-blue-700 dark:text-blue-300">Follow-up Requests</h4>
        </div>
        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <div className="pl-4 space-y-3">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Incoming</div>
            {incomingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">{request.fromName || request.fromEmail}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Wants to follow your expenses</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => rejectIncoming(request)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                    title="Reject request"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => acceptIncoming(request)}
                    className="text-green-600 hover:text-green-700 hover:bg-green-100 p-2 h-8 w-8"
                    title="Accept request"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Outgoing Requests */}
        {pending.length > 0 && (
          <div className="pl-4 space-y-3">
            <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">Outgoing</div>
            {pending.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-orange-200 rounded-lg bg-orange-50 dark:bg-orange-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-orange-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Waiting for approval</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRequest(request.id)}
                  disabled={removing}
                  className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                  title="Cancel request"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* No Requests Message */}
        {incomingRequests.length === 0 && pending.length === 0 && (
          <div className="pl-4 text-center py-4 text-muted-foreground">
            <p className="text-sm">No pending incoming or outgoing requests</p>
          </div>
        )}
      </div>
    </div>
  );
});


