import { FormEvent, useCallback, useState } from "react";
import { HudButton, HudField } from "@/ui/design-system/kit/hud-elements";

interface MessageComposerProps {
  onSend(message: string): Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  minLength?: number;
  maxLength?: number;
}

export function MessageComposer({
  onSend,
  placeholder = "Type a message…",
  disabled = false,
  isSending = false,
  minLength = 1,
  maxLength = 2000,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");

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

  return (
    <form onSubmit={handleSubmit} className="p-1.5 flex-shrink-0 transition-all duration-300">
      <div className="flex space-x-1.5 relative">
        <HudField
          type="text"
          aria-label="Message"
          placeholder={placeholder}
          value={draft}
          disabled={disabled || isSending}
          onChange={setDraft}
          onKeyDown={(e) => e.stopPropagation()}
          maxLength={maxLength}
        />
        <HudButton kind="secondary" type="submit" disabled={disabled} busy={isSending ? "Sending…" : undefined}>
          Send
        </HudButton>
      </div>
    </form>
  );
}
