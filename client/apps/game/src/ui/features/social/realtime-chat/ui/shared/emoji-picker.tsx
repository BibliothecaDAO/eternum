import React from "react";

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

export const EMOJI_CATEGORIES = {
  General: ["😀", "😂", "😍", "🤔", "😢", "😮", "👍", "👎", "🔥", "🎉"],
  War: ["⚔️", "🛡️", "🏹", "💣", "💥", "💀", "🩸", "🎯", "🎖️", "🏆"],
  Castle: ["🏰", "🏯", "🧱", "🔨", "👑", "💎", "💰", "📜", "🗺️"],
} as const;

// Keep flat export for backward compat with tests
export const EMOJIS = Object.values(EMOJI_CATEGORIES).flat();

export const EmojiPicker: React.FC<EmojiPickerProps> = ({ onEmojiSelect, onClose }) => {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("all");

  const displayedEmojis =
    selectedCategory === "all"
      ? EMOJIS
      : (EMOJI_CATEGORIES[selectedCategory as keyof typeof EMOJI_CATEGORIES] ?? EMOJIS);

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
      <div className="flex gap-1 mb-2 border-b border-gold/20 pb-1">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`px-2 py-0.5 text-xs rounded transition-colors ${
            selectedCategory === "all" ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold/70"
          }`}
        >
          All
        </button>
        {Object.keys(EMOJI_CATEGORIES).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              selectedCategory === cat ? "bg-gold/20 text-gold" : "text-gold/50 hover:text-gold/70"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-1">
        {displayedEmojis.map((emoji, index) => (
          <button
            key={index}
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
