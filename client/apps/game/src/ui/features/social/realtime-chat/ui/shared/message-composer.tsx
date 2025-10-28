import { FormEvent, useCallback, useRef, useState } from "react";
import { EmojiPicker } from "./emoji-picker";

export interface MessageComposerProps {
  onSend(message: string): Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  minLength?: number;
  maxLength?: number;
  isRecipientOffline?: boolean;
  recipientName?: string;
}

export function MessageComposer({
  onSend,
  placeholder = "Type a message…",
  disabled = false,
  isSending = false,
  minLength = 1,
  maxLength = 2000,
  isRecipientOffline = false,
  recipientName,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetDraft = useCallback(() => {
    setDraft("");
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = draft.trim();
      if (value.length < minLength) {
        return;
      }
      if (value.length > maxLength) {
        return;
      }
      try {
        await onSend(value);
        resetDraft();
      } catch (sendError) {
        console.error("Failed to send message:", sendError);
      }
    },
    [draft, maxLength, minLength, onSend, resetDraft],
  );

  const handleEmojiSelect = (emoji: string) => {
    setDraft((prevMessage) => prevMessage + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  if (isRecipientOffline) {
    return (
      <div className="p-1.5 flex-shrink-0">
        <div className="flex items-center justify-center p-2 bg-black/20 rounded text-gold/50 text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          {recipientName || "User"} is offline. You will be able to send messages when they come back online.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-1.5 flex-shrink-0 transition-all duration-300">
      <div className="flex space-x-1.5 relative">
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={draft}
          disabled={disabled || isSending}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="w-full px-2 py-1.5 bg-black/20 focus:bg-black/40 focus:outline-none text-gold placeholder-gold/30 rounded transition-all duration-300 text-sm"
          maxLength={maxLength}
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="px-2 py-1.5 bg-black/20 hover:bg-black/40 rounded transition-all duration-300 text-sm text-gold/70 hover:text-gold"
          disabled={disabled || isSending}
        >
          😀
        </button>
        <button
          type="submit"
          className="px-2 py-1.5 bg-black/20 hover:bg-black/40 rounded transition-all duration-300 text-sm text-gold/70 hover:text-gold"
          disabled={disabled || isSending}
        >
          {isSending ? "Sending…" : "Send"}
        </button>
        {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
      </div>
    </form>
  );
}
