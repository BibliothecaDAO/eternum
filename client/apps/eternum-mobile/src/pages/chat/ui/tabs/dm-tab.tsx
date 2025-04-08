import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "../chat-input";
import MessageGroupComponent, { MessageGroup } from "../message-group";

interface User {
  id: string;
  username?: string;
  is_online?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  senderUsername?: string;
  message: string;
  timestamp: Date;
  type: "direct" | "room" | "global";
  roomId?: string;
  recipientId?: string;
}

interface DMTabProps {
  onNewDMClick: () => void;
  onlineUsers: User[];
  offlineUsers: User[];
  unreadMessages: Record<string, number>;
  directMessageRecipient: string;
  onSelectRecipient: (userId: string) => void;
  messages: Message[];
  messageGroups: MessageGroup[];
  onSendMessage: (message: string) => void;
  isLoadingMessages: boolean;
  userId: string;
}

export function DMTab({
  onNewDMClick,
  onlineUsers,
  offlineUsers,
  unreadMessages,
  directMessageRecipient,
  onSelectRecipient,
  messages,
  messageGroups,
  onSendMessage,
  isLoadingMessages,
  userId,
}: DMTabProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialScrollRef = useRef(true);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({
        behavior: isInitialScrollRef.current ? "auto" : "smooth",
      });
      isInitialScrollRef.current = false;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  // @ts-ignore
  const handleCloseDM = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (directMessageRecipient === userId) {
      onSelectRecipient("");
    }
  };

  // If a direct message recipient is selected, show the chat
  if (directMessageRecipient) {
    const activeUser = [...onlineUsers, ...offlineUsers].find((u) => u.id === directMessageRecipient);

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-2 pt-0 border-b bg-background sticky top-14 z-10">
          <Button variant="ghost" size="icon" onClick={() => onSelectRecipient("")}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                {((activeUser?.username || activeUser?.id || "?").charAt(0) || "?").toUpperCase()}
              </div>
              <div
                className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-background ${
                  activeUser?.is_online ? "bg-green-500" : "bg-gray-400"
                }`}
              />
            </div>
            <span className="font-medium">{activeUser?.username || activeUser?.id}</span>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4 pb-16">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
              <p>No messages with this user yet</p>
              <p className="text-sm">Start a conversation!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messageGroups.map((group, groupIndex) => {
                // Create a unique key based on the group's first message id and index
                const groupKey = `${group.messages[0]?.id || "empty"}-${groupIndex}`;
                return (
                  <MessageGroupComponent
                    key={groupKey}
                    group={group}
                    userId={userId}
                    selectRecipient={onSelectRecipient}
                  />
                );
              })}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} onMentionClick={onNewDMClick} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <Button variant="outline" className="w-full" onClick={onNewDMClick}>
        Start New DM
      </Button>

      <ScrollArea className="flex-1">
        <div className="space-y-4">
          {/* Online Users */}
          {onlineUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Online</h3>
              <div className="space-y-2">
                {onlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                    onClick={() => onSelectRecipient(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background bg-green-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.username || user.id}</span>
                        {user.id === userId && <span className="text-sm text-muted-foreground">(You)</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {unreadMessages[user.id] > 0 && <Badge variant="secondary">{unreadMessages[user.id]}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Offline Users */}
          {offlineUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-2">Offline</h3>
              <div className="space-y-2">
                {offlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer opacity-60"
                    onClick={() => onSelectRecipient(user.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                          {((user.username || user.id || "?").charAt(0) || "?").toUpperCase()}
                        </div>
                        <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background bg-gray-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.username || user.id}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {unreadMessages[user.id] > 0 && <Badge variant="secondary">{unreadMessages[user.id]}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {onlineUsers.length === 0 && offlineUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No users available</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
