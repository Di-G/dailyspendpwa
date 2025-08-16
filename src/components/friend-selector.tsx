import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, Plus, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { getFriends, addFriend, removeFriend } from "@/lib/localStorage";
import { downloadFriendData } from "@/lib/sync";
import { Friend } from "@shared/schema";

interface FriendSelectorProps {
  selectedFriend: Friend | null;
  onFriendSelect: (friend: Friend | null) => void;
  onFriendDataLoad: (data: any) => void;
}

export default function FriendSelector({ selectedFriend, onFriendSelect, onFriendDataLoad }: FriendSelectorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [newFriendEmail, setNewFriendEmail] = useState("");
  const [newFriendName, setNewFriendName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const friends = getFriends(user?.uid);

  const handleAddFriend = async () => {
    if (!newFriendEmail || !newFriendName) {
      toast({ title: "Missing information", description: "Please fill in both email and name.", variant: "destructive" });
      return;
    }

    try {
      setIsLoading(true);
      // For now, we'll use the email as userId - in a real app, you'd want to look up the user
      const friend = addFriend({
        userId: newFriendEmail, // This should be the actual user ID in production
        displayName: newFriendName,
        email: newFriendEmail,
      }, user?.uid);
      
      setNewFriendEmail("");
      setNewFriendName("");
      setIsAddingFriend(false);
      
      toast({ title: "Friend added", description: `${friend.displayName || 'Friend'} has been added to your friends list.` });
    } catch (error) {
      toast({ title: "Failed to add friend", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFriendSelect = async (friend: Friend) => {
    try {
      setIsLoading(true);
      const friendData = await downloadFriendData(friend.userId);
      if (friendData) {
        onFriendSelect(friend);
        onFriendDataLoad(friendData);
        toast({ title: "Friend data loaded", description: `Viewing ${friend.displayName || 'Friend'}'s expenses.` });
      } else {
        // Friend exists but has no data
        onFriendSelect(friend);
        onFriendDataLoad({ expenses: [], categories: [], recurring: [] });
        toast({ title: "No data found", description: `${friend.displayName || 'Friend'} doesn't have any data yet.`, variant: "destructive" });
      }
    } catch (error) {
      console.error('Error loading friend data:', error);
      toast({ title: "Failed to load friend data", description: "Please try again.", variant: "destructive" });
      // Don't set the friend if data loading failed
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveFriend = (friendId: string) => {
    removeFriend(friendId, user?.uid);
    if (selectedFriend?.id === friendId) {
      onFriendSelect(null);
      onFriendDataLoad(null);
    }
    toast({ title: "Friend removed", description: "Friend has been removed from your list." });
  };

  // Ensure friends is always an array
  const safeFriends = Array.isArray(friends) ? friends : [];

  return (
    <div className="flex items-center space-x-2">
      {safeFriends.length > 0 ? (
        <>
          <Select value={selectedFriend?.id || ""} onValueChange={(value) => {
            if (value) {
              const friend = safeFriends.find(f => f.id === value);
              if (friend) handleFriendSelect(friend);
            }
          }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select a friend" />
            </SelectTrigger>
            <SelectContent>
              {safeFriends.map((friend) => (
                <SelectItem key={friend.id} value={friend.id}>
                  {friend.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isAddingFriend} onOpenChange={setIsAddingFriend}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add Friend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="friend-name">Display Name</Label>
                  <Input
                    id="friend-name"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    placeholder="Enter friend's name"
                  />
                </div>
                <div>
                  <Label htmlFor="friend-email">Email</Label>
                  <Input
                    id="friend-email"
                    type="email"
                    value={newFriendEmail}
                    onChange={(e) => setNewFriendEmail(e.target.value)}
                    placeholder="Enter friend's email"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddingFriend(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFriend} disabled={isLoading}>
                    {isLoading ? "Adding..." : "Add Friend"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <div className="flex items-center space-x-3">
          <div className="text-sm text-muted-foreground">
            No friends added yet
          </div>
          <Dialog open={isAddingFriend} onOpenChange={setIsAddingFriend}>
            <DialogTrigger asChild>
              <Button size="sm" variant="default">
                <Plus className="w-4 h-4 mr-1" />
                Add Your First Friend
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a Friend</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="friend-name">Display Name</Label>
                  <Input
                    id="friend-name"
                    value={newFriendName}
                    onChange={(e) => setNewFriendName(e.target.value)}
                    placeholder="Enter friend's name"
                  />
                </div>
                <div>
                  <Label htmlFor="friend-email">Email</Label>
                  <Input
                    id="friend-email"
                    type="email"
                    value={newFriendEmail}
                    onChange={(e) => setNewFriendEmail(e.target.value)}
                    placeholder="Enter friend's email"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddingFriend(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFriend} disabled={isLoading}>
                    {isLoading ? "Adding..." : "Add Friend"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {selectedFriend && (
        <div className="flex items-center space-x-2 bg-muted px-3 py-1 rounded-md">
          <User className="w-4 h-4" />
          <span className="text-sm font-medium">{selectedFriend.displayName || 'Friend'}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleRemoveFriend(selectedFriend.id)}
            className="h-6 w-6 p-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
