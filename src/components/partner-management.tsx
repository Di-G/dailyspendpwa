import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { findVerifiedUserByEmail, createPartnerRequest, type PartnerRequest } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, Trash2 } from "lucide-react";

interface PartnerManagementProps {
  hideHeader?: boolean;
  outgoingRequests: PartnerRequest[];
  onPartnerAdded?: () => void;
  onPartnerRemoved?: (requestId: string) => void;
}

export default function PartnerManagement({ hideHeader, outgoingRequests, onPartnerAdded, onPartnerRemoved }: PartnerManagementProps) {
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const { user, isVerified } = useAuth();
  const { toast } = useToast();

  const handleOpenAddPartner = () => {
    if (!isVerified) {
      setSubmitMessage("This functionality is only available to verified users. Please verify your email in Profile.");
      setAddPartnerOpen(true);
      return;
    }
    setSubmitMessage("Enter your partner's name and email. The user must be verified for you to add them.");
    setAddPartnerOpen(true);
  };

  const handleSubmitPartner = async () => {
    if (!user) return;
    setSubmitMessage("");
    const name = partnerName.trim();
    const email = partnerEmail.trim();
    if (!name || !email) {
      setSubmitMessage("Please enter both name and email address.");
      return;
    }
    if (email.toLowerCase() === (user.email || "").toLowerCase()) {
      setSubmitMessage("You cannot add yourself as a partner.");
      return;
    }
    setSubmitLoading(true);
    try {
      const found = await findVerifiedUserByEmail(email);
      if (!found) {
        setSubmitMessage("No verified user found with that email.");
        return;
      }
      await createPartnerRequest({
        fromUid: user.uid,
        fromEmail: user.email || "",
        fromName: user.displayName || "",
        toUid: found.uid,
        toEmail: found.email,
        toName: name,
      });
      // Close dialog on success and clear fields
      setPartnerName("");
      setPartnerEmail("");
      setAddPartnerOpen(false);
      toast({ title: "Partner request sent", description: "Your partner will receive a notification to accept." });
      onPartnerAdded?.();
    } catch (e) {
      setSubmitMessage("Failed to send request. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleRemoveRequest = async (request: PartnerRequest) => {
    if (removing) return; // Prevent multiple clicks
    
    setRemoving(true);
    try {
      // Call the parent callback to remove the request
      await onPartnerRemoved?.(request.id);
      
      toast({ 
        title: "Request removed", 
        description: `Removed ${request.toName || request.toEmail} from your partner list.` 
      });
    } catch (error) {
      // Error is already handled by the parent component
      console.error('Error removing partner request:', error);
    } finally {
      setRemoving(false);
    }
  };

  const pendingRequests = outgoingRequests.filter(r => r.status === 'pending');
  const acceptedRequests = outgoingRequests.filter(r => r.status === 'accepted');
  const rejectedRequests = outgoingRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled');

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Manage Partners</h3>
          <Button onClick={handleOpenAddPartner} size="sm" className="bg-rose-600 hover:bg-rose-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Partner
          </Button>
        </div>
      )}

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-amber-700 dark:text-amber-300">Pending Requests</h4>
          <div className="space-y-2">
            {pendingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-amber-200 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-amber-600">Waiting for approval</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Partners */}
      {acceptedRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-green-700 dark:text-green-300">Active Partners</h4>
          <div className="space-y-2">
            {acceptedRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-green-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-green-600">Partner</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected/Cancelled Requests */}
      {rejectedRequests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-red-700 dark:text-red-300">Rejected/Cancelled</h4>
          <div className="space-y-2">
            {rejectedRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-red-200 rounded-lg bg-red-50 dark:bg-red-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-red-600" />
                  <div>
                    <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                    <div className="text-xs text-red-600">
                      {request.status === 'rejected' ? 'Request rejected' : 'Request cancelled'}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveRequest(request)}
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

      {/* No Partners Message */}
      {outgoingRequests.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm">No partners added yet</p>
          <p className="text-xs">Add a partner to share expenses and collaborate</p>
        </div>
      )}

      {/* Add Partner Button (if no header) */}
      {hideHeader && (
        <Button onClick={handleOpenAddPartner} className="w-full bg-rose-600 hover:bg-rose-700">
          <Plus className="w-4 h-4 mr-2" />
          Add New Partner
        </Button>
      )}

      {/* Add Partner Dialog */}
      <Dialog open={addPartnerOpen} onOpenChange={setAddPartnerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Partner</DialogTitle>
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
                <Input 
                  value={partnerName} 
                  onChange={(e) => setPartnerName(e.target.value)} 
                  placeholder="Enter partner's name" 
                />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input 
                  value={partnerEmail} 
                  onChange={(e) => setPartnerEmail(e.target.value)} 
                  placeholder="Enter partner's email" 
                  type="email" 
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The user must be verified for you to add them as a partner.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPartnerOpen(false)}>
              Cancel
            </Button>
            {isVerified && (
              <Button 
                className="bg-rose-600 hover:bg-rose-700" 
                onClick={handleSubmitPartner} 
                disabled={submitLoading}
              >
                {submitLoading ? "Sending..." : "Send Request"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
