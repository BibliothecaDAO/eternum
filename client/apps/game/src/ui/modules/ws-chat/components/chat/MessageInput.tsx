import Button from "@/ui/elements/button";
import React, { useEffect, useRef, useState } from "react";

// MessageInput component to prevent re-renders of the entire app when typing
const MessageInput = React.memo(({ onSendMessage }: { onSendMessage: (message: string) => void }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    onSendMessage(message);
    setMessage("");
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prevMessage) => prevMessage + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showEmojiPicker && !(event.target as Element).closest(".emoji-picker")) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  return (
    <form
      onSubmit={handleSubmit}
      className={`p-2 border-t border-gold/30 flex-shrink-0 transition-all duration-300 ${
        isFocused ? "bg-brown/80" : "bg-brown/40"
      }`}
    >
      <div className="flex space-x-2 relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="w-full px-3 py-2 bg-gold/10 focus:bg-gold/20 focus:outline-none text-gold placeholder-gold/30 border border-gold/30 rounded transition-all duration-300"
        />
        <Button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="px-3 py-2 bg-gold/10 hover:bg-gold/20 border border-gold/30 rounded transition-all duration-300"
        >
          😀
        </Button>
        <Button
          type="submit"
          className="px-3 py-2 bg-gold/20 hover:bg-gold/30 border border-gold/30 rounded transition-all duration-300"
        >
          Send
        </Button>
        {showEmojiPicker && (
          <div className="emoji-picker absolute bottom-full right-0 mb-2 p-2 bg-brown/95 border border-gold/50 rounded shadow-lg backdrop-blur-sm">
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
                  className="p-1 hover:bg-gold/30 rounded text-lg transition-colors duration-200"
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
