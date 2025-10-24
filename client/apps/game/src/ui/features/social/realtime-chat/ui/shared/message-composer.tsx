import { Button } from "@/ui/design-system/atoms";
import { FormEvent, useCallback, useState } from "react";

export interface MessageComposerProps {
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
  const [error, setError] = useState<string | null>(null);

  const resetDraft = useCallback(() => {
    setDraft("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = draft.trim();
      if (value.length < minLength) {
        setError(`Please enter at least ${minLength} character${minLength === 1 ? "" : "s"}.`);
        return;
      }
      if (value.length > maxLength) {
        setError(`Message cannot exceed ${maxLength} characters.`);
        return;
      }
      try {
        await onSend(value);
        resetDraft();
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Failed to send message.";
        setError(message);
      }
    },
    [draft, maxLength, minLength, onSend, resetDraft],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-1">
      <textarea
        className="w-full border-neutral-700 bg-dark-wood px-3 py-2 text-sm outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 disabled:opacity-60"
        placeholder={placeholder}
        value={draft}
        disabled={disabled || isSending}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        rows={3}
        maxLength={maxLength}
      />
      <div className="flex items-center justify-between gap-2 p-1">
        <span className="text-xs ">
          {draft.length} / {maxLength}
        </span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <Button type="submit" disabled={disabled || isSending}>
            {isSending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </form>
  );
}
