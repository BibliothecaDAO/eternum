import { ScrollArea } from "@/shared/ui/scroll-area";
import { useEffect, useRef, useState } from "react";
import { ChatInput } from "../chat-input";

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
  onSendMessage: (message: string) => void;
  isLoadingMessages: boolean;
  userId: string;
}

export function GlobalChatTab({ 
  onMentionClick, 
  messages, 
  onSendMessage,
  isLoadingMessages,
  userId
}: GlobalChatTabProps) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
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
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">
                    {message.senderId === userId ? "You" : message.senderUsername || message.senderId}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm">{message.message}</p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        )}
      </ScrollArea>

      <ChatInput value={inputValue} onChange={setInputValue} onSend={handleSend} onMentionClick={onMentionClick} />
    </div>
  );
}
