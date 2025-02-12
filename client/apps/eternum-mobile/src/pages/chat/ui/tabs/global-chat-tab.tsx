import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  sender: string;
  timestamp: string;
  message: string;
}

interface GlobalChatTabProps {
  onMentionClick: () => void;
}

const dummyMessages: Message[] = [
  {
    id: "1",
    sender: "Alice",
    timestamp: "10:00 AM",
    message: "Hello everyone!",
  },
  {
    id: "2",
    sender: "Bob",
    timestamp: "10:01 AM",
    message: "Hey Alice, how are you?",
  },
  // Add more dummy messages here
];

export function GlobalChatTab({ onMentionClick }: GlobalChatTabProps) {
  const [messages, setMessages] = useState<Message[]>(dummyMessages);
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
  );
}
