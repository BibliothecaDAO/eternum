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
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 disabled:opacity-60"
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
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-neutral-500">{draft.length} / {maxLength}</span>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            type="submit"
            className="rounded bg-amber-500 px-3 py-1 text-sm font-semibold text-neutral-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-700 disabled:text-neutral-300"
            disabled={disabled || isSending}
          >
            {isSending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}

