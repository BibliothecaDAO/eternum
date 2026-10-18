import { FormEvent, useCallback, useRef, useState } from "react";
import { EmojiPicker } from "./emoji-picker";
import { HudButton, HudField, HudNotice } from "@/ui/design-system/kit/hud-elements";

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
        <HudNotice
          tone="warn"
          line={`${recipientName || "User"} is offline. You will be able to send messages when they come back online.`}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="p-1.5 flex-shrink-0 transition-all duration-300">
      <div className="flex space-x-1.5 relative">
        <HudField
          ref={inputRef}
          type="text"
          aria-label="Message"
          placeholder={placeholder}
          value={draft}
          disabled={disabled || isSending}
          onChange={setDraft}
          onKeyDown={(e) => e.stopPropagation()}
          maxLength={maxLength}
        />
        <HudButton
          kind="secondary"
          aria-label="Emoji"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          disabled={disabled || isSending}
        >
          😀
        </HudButton>
        <HudButton kind="secondary" type="submit" disabled={disabled} busy={isSending ? "Sending…" : undefined}>
          Send
        </HudButton>
        {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
      </div>
    </form>
  );
}
