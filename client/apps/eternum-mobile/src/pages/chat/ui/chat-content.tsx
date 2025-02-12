import { ScrollArea } from "@/shared/ui/scroll-area";
import { useEffect, useRef } from "react";
import { Message } from "../types";

interface ChatContentProps {
  messages: Message[];
}

export const ChatContent = ({ messages }: ChatContentProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (scrollAreaRef.current) {
      const scrollArea = scrollAreaRef.current;
      scrollArea.scrollTop = scrollArea.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-medium">{msg.sender}</span>
              {msg.guild && <span className="text-sm text-muted-foreground">[{msg.guild}]</span>}
              <span className="text-sm text-muted-foreground">{msg.timestamp}</span>
            </div>
            <p className="text-sm">{msg.content}</p>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
