import Button from "@/ui/elements/button";
import React, { useState } from "react";

// MessageInput component to prevent re-renders of the entire app when typing
const MessageInput = React.memo(({ onSendMessage }: { onSendMessage: (message: string) => void }) => {
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="p-2 md:p-3  border-gray-900/30 flex-shrink-0 rounded bg-transparent">
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-2 bg-gold/20 focus:outline-none text-gold placeholder-gold/50 border border-gold/30 rounded"
        />
        <Button type="submit">Send</Button>
      </div>
    </form>
  );
});

export default MessageInput;
