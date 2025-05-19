import React, { useEffect, useRef, useState } from "react";

// MessageInput component to prevent re-renders of the entire app when typing
const MessageInput = React.memo(
  ({
    onSendMessage,
    onFocusChange,
  }: {
    onSendMessage: (message: string) => void;
    onFocusChange: (isFocused: boolean) => void;
  }) => {
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

    // Update parent component when focus state changes
    useEffect(() => {
      onFocusChange(isFocused);
    }, [isFocused, onFocusChange]);

    return (
      <form onSubmit={handleSubmit} className={`p-1.5 flex-shrink-0 transition-all duration-300`}>
        <div className="flex space-x-1.5 relative">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="w-full px-2 py-1.5 bg-black/20 focus:bg-black/40 focus:outline-none text-gold placeholder-gold/30 rounded transition-all duration-300 text-sm"
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="px-2 py-1.5 bg-black/20 hover:bg-black/40 rounded transition-all duration-300 text-sm"
          >
            😀
          </button>
          <button
            type="submit"
            className="px-2 py-1.5 bg-black/20 hover:bg-black/40 rounded transition-all duration-300 text-sm"
          >
            Send
          </button>
          {showEmojiPicker && (
            <div className="emoji-picker absolute bottom-full right-0 mb-2 p-2 bg-black/90 rounded shadow-lg backdrop-blur-sm">
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
                    className="p-1 hover:bg-gold/20 rounded text-lg transition-colors duration-200"
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
  },
);

export default MessageInput;
