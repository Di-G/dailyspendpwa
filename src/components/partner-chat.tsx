import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { ensureDirectChat, getDirectChatId, sendChatMessage, subscribeToChatMessages, subscribeToChatMeta, updateChatClearedAt, sendChatReminder, type ChatMessage, type ChatMeta } from "@/lib/sync";
import { Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type PartnerChatProps = {
  peerUid: string | null;
  peerName?: string;
};

export default function PartnerChat({ peerUid, peerName }: PartnerChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [clearedAtMs, setClearedAtMs] = useState<number>(0);
  const MAX_LOCAL_MESSAGES = 100;
  const [meta, setMeta] = useState<ChatMeta | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.uid || !peerUid) return;
    const chatId = getDirectChatId(user.uid, peerUid);
    const key = `dailyspend_chat_clear_${chatId}_${user.uid}`;
    const saved = Number(localStorage.getItem(key) || 0);
    setClearedAtMs(Number.isFinite(saved) ? saved : 0);
    const init = async () => {
      try {
        await ensureDirectChat(chatId, user.uid, peerUid);
      } catch {}
    };
    void init();
    const stopMsgs = subscribeToChatMessages(chatId, (msgs) => {
      setMessages(msgs);
      // Auto scroll to bottom on new message
      requestAnimationFrame(() => {
        try {
          if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
          } else if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
          }
        } catch {}
      });
    });
    const stopMeta = subscribeToChatMeta(chatId, (m) => {
      setMeta(m);
    });
    return () => { try { stopMsgs(); } catch {} try { stopMeta(); } catch {} };
  }, [user?.uid, peerUid]);

  const handleSend = async () => {
    if (!user?.uid || !peerUid) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    if (visibleMessages.length >= MAX_LOCAL_MESSAGES) return;
    try {
      const chatId = getDirectChatId(user.uid, peerUid);
      await sendChatMessage({ chatId, fromUid: user.uid, peerUid, text: trimmed, fromName: user.displayName || undefined });
      setText("");
      // Ensure we stay at bottom after sending
      requestAnimationFrame(() => {
        try {
          if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
        } catch {}
      });
    } catch {}
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!peerUid) {
    return (
      <div className="p-4 text-sm text-muted-foreground">No partner connected for chat yet.</div>
    );
  }

  const timestampToMs = (v: unknown): number => {
    try {
      const d = (v as any)?.toDate?.();
      if (d instanceof Date) return d.getTime();
    } catch {}
    return 0;
  };

  const chatId = user?.uid && peerUid ? getDirectChatId(user.uid, peerUid) : "";
  const filteredByClear = messages.filter((m) => timestampToMs(m.createdAt) > clearedAtMs);
  const totalVisibleCount = filteredByClear.length;
  const atLimit = totalVisibleCount >= MAX_LOCAL_MESSAGES;
  // When at limit, do not show any more new messages (cap at first MAX_LOCAL_MESSAGES)
  const visibleMessages = atLimit ? filteredByClear.slice(0, MAX_LOCAL_MESSAGES) : filteredByClear;
  const remaining = Math.max(0, MAX_LOCAL_MESSAGES - totalVisibleCount);

  // Compute peer's visible count based on their last cleared timestamp from chat meta
  const peerClearedMs = (() => {
    try {
      const ts = (meta?.clearedAtBy as any)?.[peerUid!];
      const d = ts?.toDate?.();
      return d instanceof Date ? d.getTime() : 0;
    } catch {
      return 0;
    }
  })();
  const peerVisibleCount = messages.filter((m) => timestampToMs(m.createdAt) > peerClearedMs).length;
  const peerAtLimit = peerVisibleCount >= MAX_LOCAL_MESSAGES;
  const peerNeedsClear = peerAtLimit;
  const showWarning = visibleMessages.length >= 90; // Show only once count hits 90
  const isRed = visibleMessages.length >= 95; // Turn red at 95

  const handleClearLocal = () => {
    if (!user?.uid || !peerUid) return;
    const now = Date.now();
    const key = `dailyspend_chat_clear_${chatId}_${user.uid}`;
    try {
      localStorage.setItem(key, String(now));
    } catch {}
    setClearedAtMs(now);
    // Mirror to chat meta so the other side can be informed
    void updateChatClearedAt(chatId, user.uid);
    requestAnimationFrame(() => {
      try { if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth", block: "end" }); } catch {}
    });
  };

  // no-op effect removed; peerNeedsClear derived from chat meta + messages

  const handleSendReminder = async () => {
    if (!user?.uid || !peerUid) return;
    const chatId = getDirectChatId(user.uid, peerUid);
    await sendChatReminder(chatId, peerUid);
    toast({ title: "Reminder sent", description: `We asked ${peerName || 'your partner'} to clear the chat.` });
  };

  // Show in-app notification when partner sends a clear reminder
  useEffect(() => {
    if (!user?.uid || !peerUid || !meta) return;
    const key = `dailyspend_chat_remind_seen_${chatId}_${user.uid}`;
    const lastSeen = Number(localStorage.getItem(key) || 0);
    const raw = (meta.remindClearAtBy as any)?.[user.uid];
    const ts = raw?.toDate?.() instanceof Date ? raw.toDate().getTime() : 0;
    if (ts > lastSeen) {
      toast({
        title: "Reminder to clear chat",
        description: `${peerName || 'Partner'} asked you to clear the chat to continue messaging.`,
      });
      try { localStorage.setItem(key, String(ts)); } catch {}
    }
  }, [meta?.remindClearAtBy, user?.uid, peerUid, chatId, peerName, toast]);

  return (
    <Card className="h-[65vh] sm:h-[70vh] flex flex-col rounded-2xl border shadow-sm overflow-hidden bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20 border-rose-200 dark:border-rose-800">
      <div className="p-4 border-b border-rose-200 dark:border-rose-700 bg-gradient-to-r from-rose-100 to-pink-100 dark:from-rose-900/30 dark:to-pink-900/30">
        <div className="flex items-center justify-between gap-2">
          <div className="text-lg font-semibold flex items-center">
            <span className="text-rose-600 dark:text-rose-400 mr-2">💬</span>
            Chat{peerName ? ` with ${peerName}` : ""}
          </div>
          <div className="flex items-center gap-2">
            {peerNeedsClear && (
              <Button
                variant="outline"
                size="icon"
                title="Remind partner to clear chat"
                onClick={(e) => { void handleSendReminder(); try { (e.currentTarget as HTMLButtonElement).blur(); } catch {} }}
                onMouseUp={(e) => { try { (e.currentTarget as HTMLButtonElement).blur(); } catch {} }}
                onTouchEnd={(e) => { try { (e.currentTarget as HTMLButtonElement).blur(); } catch {} }}
                className="border-rose-300 text-rose-600 hover:bg-rose-100 dark:border-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/30"
              >
                <Bell className="w-4 h-4" />
              </Button>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleClearLocal}
              className="border-rose-300 text-rose-600 hover:bg-rose-100 dark:border-rose-600 dark:text-rose-400 dark:hover:bg-rose-900/30"
            >
              Clear chat
            </Button>
          </div>
        </div>
      </div>
      <CardContent className="flex-1 p-0 flex flex-col min-h-0">
        {/* Warning bar about limit */}
        {(peerNeedsClear || showWarning) && (
          <div className={`px-3 py-2 text-xs ${atLimit || isRed ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'} border-b`}> 
            {peerNeedsClear ? (
              <div className="flex items-center justify-between">
                <span>Your partner has reached their message limit and cannot receive messages. Ask them to clear the chat to continue.</span>
              </div>
            ) : atLimit ? (
              <div className="flex items-center justify-between">
                <span>Message limit reached (100).</span>
              </div>
            ) : isRed ? (
              <div className="flex items-center justify-between">
                <span>Approaching limit. {remaining} left out of 100.</span>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span>Chat auto-clears at 100 messages. {remaining} left.</span>
              </div>
            )}
          </div>
        )}

        <div ref={listRef} className="flex-1 p-3 space-y-2 overflow-y-auto">
          {visibleMessages.length === 0 && (
            <div className="text-sm text-muted-foreground">Say hi 👋</div>
          )}
          {visibleMessages.map((m) => {
            const isMine = m.fromUid === user?.uid;
            return (
              <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm shadow-sm ${isMine ? "bg-primary text-white border border-white/20" : "bg-background border border-border"}`}>
                  {!isMine && (
                    <div className="text-[10px] text-muted-foreground mb-0.5">
                      {m.fromName || "Partner"}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="p-2 flex items-center gap-2 border-t">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={peerNeedsClear ? "Partner reached message limit — ask them to clear" : "Type a message"}
            disabled={atLimit || peerNeedsClear}
          />
          <Button onClick={handleSend} disabled={!text.trim() || atLimit || peerNeedsClear} className="bg-rose-600 hover:bg-rose-700">
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


