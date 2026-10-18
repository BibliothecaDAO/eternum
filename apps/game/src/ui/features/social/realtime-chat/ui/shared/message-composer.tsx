import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { FormEvent, useCallback, useRef, useState } from "react";
import { EmojiPicker } from "./emoji-picker";

interface MessageComposerProps {
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
        <div className="flex items-center justify-center p-2 bg-hud-well rounded text-hud-cue text-hud-body">
          <SemanticIcon name="warning" className="h-4 w-4 mr-2" />
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
          className="w-full px-2 py-1.5 bg-hud-well focus:bg-hud-well focus:outline-none text-hud-accent placeholder-gold/30 rounded transition-all duration-300 text-hud-body max-lg:min-h-11"
          maxLength={maxLength}
        />
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="px-2 py-1.5 bg-hud-well hover:bg-hud-well rounded transition-all duration-300 text-hud-body text-hud-muted hover:text-hud-accent max-lg:min-h-11 max-lg:min-w-11"
          disabled={disabled || isSending}
        >
          😀
        </button>
        <button
          type="submit"
          className="px-2 py-1.5 bg-hud-well hover:bg-hud-well rounded transition-all duration-300 text-hud-body text-hud-muted hover:text-hud-accent max-lg:min-h-11"
          disabled={disabled || isSending}
        >
          {isSending ? "Sending…" : "Send"}
        </button>
        {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
      </div>
    </form>
  );
}
