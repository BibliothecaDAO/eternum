import React from "react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  const emojis = [
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
  ];

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest(".emoji-picker")) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div className="emoji-picker absolute bottom-full right-0 mb-2 p-2 bg-black/90 rounded shadow-lg backdrop-blur-sm z-50">
      <div className="grid grid-cols-8 gap-1">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onEmojiSelect(emoji)}
            className="p-1 hover:bg-gold/20 rounded text-lg transition-colors duration-200"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
