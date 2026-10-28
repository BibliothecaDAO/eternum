import { FormEvent, KeyboardEvent, useCallback, useId, useRef, useState } from "react";
import { EmojiPicker } from "./emoji-picker";
import { HudButton, HudField, HudMenu, HudNotice, menuOptionId } from "@/ui/design-system/kit/hud-elements";
import type { MentionablePlayer } from "../../hooks/use-chat-mentions";
import { insertMention, mentionChoices, typedMention } from "../../model/mentions";

interface MessageComposerProps {
  onSend(message: string): Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  minLength?: number;
  maxLength?: number;
  isRecipientOffline?: boolean;
  recipientName?: string;
  /** Who an "@" typed in the message may name: a list of them opens over the field as the name is typed. */
  mentions?: readonly MentionablePlayer[];
}

const NO_MENTIONS: readonly MentionablePlayer[] = [];

export function MessageComposer({
  onSend,
  placeholder = "Type a message…",
  disabled = false,
  isSending = false,
  minLength = 1,
  maxLength = 2000,
  isRecipientOffline = false,
  recipientName,
  mentions = NO_MENTIONS,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  // The "@" whose list was put away (a name picked, or Escape): it stays closed until another "@" is typed.
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const typed = typedMention(draft, caret);
  const byName = new Map(mentions.map((player) => [player.name, player]));
  const choices = typed && typed.at !== closedAt ? mentionChoices([...byName.keys()], typed.query) : [];
  const chosen = Math.min(active, Math.max(choices.length - 1, 0));

  const resetDraft = useCallback(() => {
    setDraft("");
    setCaret(0);
    setClosedAt(null);
  }, []);

  const readCaret = () => setCaret(inputRef.current?.selectionStart ?? 0);

  const pickMention = (name: string) => {
    if (!typed) return;
    const next = insertMention(draft, typed.at, caret, name);
    setDraft(next.text);
    setCaret(next.caret);
    setClosedAt(typed.at);
    const input = inputRef.current;
    input?.focus();
    // The field takes its new value on the next render; the caret goes after the name once it has.
    requestAnimationFrame(() => input?.setSelectionRange(next.caret, next.caret));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    // Every key typed here is the message's, never a HUD shortcut.
    event.stopPropagation();
    if (choices.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((chosen + step + choices.length) % choices.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      pickMention(choices[chosen]!);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setClosedAt(typed?.at ?? null);
    }
  };

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
          onChange={(value) => {
            const typedNow = typedMention(value, inputRef.current?.selectionStart ?? value.length);
            setDraft(value);
            readCaret();
            setActive(0);
            if (typedNow?.at !== closedAt) setClosedAt(null);
          }}
          onSelect={readCaret}
          onKeyDown={onKeyDown}
          maxLength={maxLength}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={choices.length > 0}
          aria-controls={choices.length > 0 ? listId : undefined}
          aria-activedescendant={choices.length > 0 ? menuOptionId(listId, chosen) : undefined}
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
        {choices.length > 0 && (
          // A press on a name keeps the keyboard in the field, so a phone's keyboard stays up.
          <div className="absolute bottom-full left-0 mb-1" onMouseDown={(event) => event.preventDefault()}>
            <HudMenu
              suggests={{ id: listId, active: chosen }}
              aria-label="Mention a player"
              items={choices.map((name) => ({
                label: name,
                lead: <img src={byName.get(name)!.portrait} alt="" className="h-6 w-6 rounded object-cover" />,
                onSelect: () => pickMention(name),
              }))}
            />
          </div>
        )}
        {showEmojiPicker && <EmojiPicker onEmojiSelect={handleEmojiSelect} onClose={() => setShowEmojiPicker(false)} />}
      </div>
    </form>
  );
}
