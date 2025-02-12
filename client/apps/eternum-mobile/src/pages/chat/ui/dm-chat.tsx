import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  sender: string;
  timestamp: string;
  message: string;
}

interface User {
  id: string;
  name: string;
  guild: string;
  avatar?: string;
  online: boolean;
}

interface DMChatProps {
  user: User;
  onBack: () => void;
  onMentionClick: () => void;
}

export function DMChat({ user, onBack, onMentionClick }: DMChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "You",
      timestamp: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      message: inputValue.trim(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");
  };

  return (
    <>
      <div className="flex items-center gap-2 p-2 pt-0 border-b bg-background sticky top-14 z-10">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div
              className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-background ${
                user.online ? "bg-green-500" : "bg-gray-400"
              }`}
            />
          </div>
          <span className="font-medium">{user.name}</span>
        </div>
      </div>
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 p-4 pb-16">
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{message.sender}</span>
                  <span className="text-sm text-muted-foreground">{message.timestamp}</span>
                </div>
                <p className="text-sm">{message.message}</p>
              </div>
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        <div className="p-4 border-t flex gap-2 fixed bottom-16 w-full bg-background">
          <Button variant="outline" size="icon" className="shrink-0" onClick={onMentionClick}>
            @
          </Button>
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button onClick={handleSend} className="shrink-0">
            Send
          </Button>
        </div>
      </div>
    </>
  );
}
