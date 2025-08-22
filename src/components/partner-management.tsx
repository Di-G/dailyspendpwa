import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/lib/auth";
import { findVerifiedUserByEmail, createPartnerRequest, type PartnerRequest } from "@/lib/sync";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, X, Trash2, Check } from "lucide-react";

interface PartnerManagementProps {
  hideHeader?: boolean;
  outgoingRequests: PartnerRequest[];
  incomingRequests?: PartnerRequest[];
  acceptedIncomingPartners?: PartnerRequest[];
  onPartnerAdded?: () => void;
  onPartnerRemoved?: (requestId: string) => void;
  onPartnerRequestStatusUpdated?: (requestId: string, status: PartnerRequest["status"]) => void;
}

export default function PartnerManagement({ hideHeader, outgoingRequests, incomingRequests = [], acceptedIncomingPartners = [], onPartnerAdded, onPartnerRemoved, onPartnerRequestStatusUpdated }: PartnerManagementProps) {
  const [addPartnerOpen, setAddPartnerOpen] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [removing, setRemoving] = useState(false);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
  const [partnerToRemove, setPartnerToRemove] = useState<PartnerRequest | null>(null);
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
    
    // For active partners, show confirmation dialog
    if (request.status === 'accepted') {
      setPartnerToRemove(request);
      setRemoveConfirmOpen(true);
      return;
    }
    
    // For other statuses (pending, rejected, cancelled), remove directly without confirmation
    await performRemove(request);
  };

  const performRemove = async (request: PartnerRequest) => {
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

  const handleConfirmRemove = async () => {
    if (partnerToRemove) {
      await performRemove(partnerToRemove);
      setRemoveConfirmOpen(false);
      setPartnerToRemove(null);
    }
  };

  const pendingRequests = outgoingRequests.filter(r => r.status === 'pending');
  const acceptedRequests = outgoingRequests.filter(r => r.status === 'accepted');
  const rejectedRequests = outgoingRequests.filter(r => r.status === 'rejected' || r.status === 'cancelled');

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <Card className="bg-gradient-to-r from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <span className="text-rose-600 dark:text-rose-400 mr-2">👥</span>
                Manage Partners
              </h3>
              <Button onClick={handleOpenAddPartner} size="sm" className="bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
                <Plus className="w-4 h-4 mr-2" />
                Add Partner
              </Button>
            </div>
          </CardContent>
        </Card>
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

      {/* Remove Partner Confirmation Dialog */}
      <Dialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Partner?</DialogTitle>
          </DialogHeader>
          {partnerToRemove && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <span className="font-medium">{partnerToRemove.toName || partnerToRemove.toEmail}</span> as your partner?
              </p>
              <p className="text-xs text-muted-foreground">
                This will permanently remove the partnership and you won't be able to share expenses with them anymore.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleConfirmRemove}
              disabled={removing}
            >
              {removing ? "Removing..." : "Remove Partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Being Viewed As Partner Section */}
      {acceptedIncomingPartners.length > 0 && (
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200 dark:border-indigo-800">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-sm"></div>
                <h4 className="text-base font-medium text-indigo-700 dark:text-indigo-300">Being Viewed As Partner</h4>
              </div>
              <div className="space-y-2">
                {acceptedIncomingPartners.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border border-indigo-200 rounded-lg bg-indigo-100/50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <div className="text-sm font-medium">{request.fromName || request.fromEmail}</div>
                        <div className="text-xs text-indigo-600 dark:text-indigo-400">Can view your expenses as partner</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRequest(request)}
                      disabled={removing}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 p-2 h-8 w-8"
                      title="Remove yourself from their partner list"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Partners Section */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full shadow-sm"></div>
              <h4 className="text-base font-medium text-green-700 dark:text-green-300">Active Partners</h4>
            </div>
            {acceptedRequests.length > 0 ? (
              <div className="space-y-2">
                {acceptedRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border border-green-200 rounded-lg bg-green-100/50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-green-600 dark:text-green-400" />
                      <div>
                        <div className="text-sm font-medium">{request.toName || request.toEmail}</div>
                        <div className="text-xs text-green-600 dark:text-green-400">You are viewing their expenses as a partner</div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRequest(request)}
                      disabled={removing}
                      className="text-red-600 hover:text-red-700 hover:bg-red-100 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30 p-2 h-8 w-8"
                      title="Remove partner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center">
                <p className="text-sm font-medium text-foreground mb-1">None</p>
                <p className="text-xs text-muted-foreground mb-3">Add a partner to share expenses and collaborate</p>
                <Button onClick={handleOpenAddPartner} className="bg-rose-600 hover:bg-rose-700 text-white shadow-md hover:shadow-lg transition-all duration-200">
                  <Plus className="w-4 h-4 mr-2" />
                  Add New Partner
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rejected/Cancelled Requests Section */}
      {rejectedRequests.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <h4 className="text-base font-medium text-red-700 dark:text-red-300">Rejected/Cancelled Requests</h4>
          </div>
          <div className="pl-4 space-y-2">
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

      {/* Partner Requests Section - Moved to the end */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <h4 className="text-base font-medium text-blue-700 dark:text-blue-300">Partner Requests</h4>
        </div>
        
        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <div className="pl-4 space-y-2">
            <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">Incoming</div>
            {incomingRequests.map((request) => (
              <div key={request.id} className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <div>
                    <div className="text-sm font-medium">{request.fromName || request.fromEmail}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Wants to add you as partner</div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPartnerRequestStatusUpdated?.(request.id, 'rejected')}
                    className="text-red-600 hover:text-red-700 hover:bg-red-100 p-2 h-8 w-8"
                    title="Reject request"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onPartnerRequestStatusUpdated?.(request.id, 'accepted')}
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
        {pendingRequests.length > 0 && (
          <div className="pl-4 space-y-2">
            <div className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-2">Outgoing</div>
            {pendingRequests.map((request) => (
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
                  onClick={() => handleRemoveRequest(request)}
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
        {incomingRequests.length === 0 && pendingRequests.length === 0 && (
          <div className="pl-4 text-center py-4 text-muted-foreground">
            <p className="text-sm">No pending incoming or outgoing requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
