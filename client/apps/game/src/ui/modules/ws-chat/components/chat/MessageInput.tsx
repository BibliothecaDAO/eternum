import Button from "@/ui/elements/button";
import React, { useState } from "react";

// MessageInput component to prevent re-renders of the entire app when typing
const MessageInput = React.memo(({ onSendMessage }: { onSendMessage: (message: string) => void }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage("");
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prevMessage) => prevMessage + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <form onSubmit={handleSubmit} className="p-1  border-gray-900/30 flex-shrink-0 rounded bg-transparent">
      <div className="flex space-x-2 relative">
        <input
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full   px-2 bg-gold/5 focus:outline-none text-gold placeholder-gold/30 border border-gold/30 rounded"
        />
        <Button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
          😀
        </Button>
        <Button type="submit">Send</Button>
        {showEmojiPicker && (
          <div className="absolute bottom-full right-0 mb-2 p-2 bg-brown border border-gold/50 rounded shadow-lg">
            <div className="grid grid-cols-8 gap-1">
              {[
                "😀",
                "😂",
                "😍",
                "🤔",
                "😢",
                "😮",
                "👍",
                "👎",
                "🔥",
                "🎉", // General
                "⚔️",
                "🛡️",
                "🏹",
                "💣",
                "💥",
                "💀",
                "🩸",
                "🎯",
                "🎖️",
                "🏆", // War
                "🏰",
                "🏯",
                "🧱",
                "🔨",
                "👑",
                "💎",
                "💰",
                "📜",
                "🗺️",
                "🏯", // Castle & Medieval
              ].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  className="p-1 hover:bg-gold/30 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </form>
  );
});

export default MessageInput;
