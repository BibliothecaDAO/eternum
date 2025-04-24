import { ScrollArea } from "@/shared/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "../chat-input";
import MessageGroupComponent, { MessageGroup } from "../message-group";

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

interface GlobalChatTabProps {
  onMentionClick: () => void;
  messages: Message[];
  messageGroups: MessageGroup[];
  onSendMessage: (message: string) => void;
  isLoadingMessages: boolean;
  userId: string;
  selectRecipient: (userId: string) => void;
}

export function GlobalChatTab({
  onMentionClick,
  messages,
  messageGroups,
  onSendMessage,
  isLoadingMessages,
  userId,
  selectRecipient,
}: GlobalChatTabProps) {
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

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4 pb-16">
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p>No messages in global chat yet</p>
            <p className="text-sm">Be the first to send a message!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messageGroups.map((group, groupIndex) => {
              // Create a unique key based on the group's first message id and index
              const groupKey = `${group.messages[0]?.id || "empty"}-${groupIndex}`;
              return (
                <MessageGroupComponent key={groupKey} group={group} userId={userId} selectRecipient={selectRecipient} />
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} onMentionClick={onMentionClick} />
    </div>
  );
}
