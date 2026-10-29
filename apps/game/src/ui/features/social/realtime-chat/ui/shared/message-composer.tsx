import { FormEvent, KeyboardEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { HudButton, HudField, HudIconButton, HudMenu, menuOptionId } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import type { MentionablePlayer } from "../../hooks/use-chat-mentions";
import { insertMention, mentionChoices, typedMention } from "../../model/mentions";
import type { SharedPlace } from "../../model/place";
import { PlaceChip } from "./chat-map";
import { useChatMap } from "./use-chat-map";

interface MessageComposerProps {
  /** Sends the words, and the place that goes with them. A place sent with no words is written as its name. */
  onSend(message: string, place: SharedPlace | null): Promise<void> | void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  minLength?: number;
  maxLength?: number;
  /** Who an "@" typed in the message may name: a list of them opens over the field as the name is typed. */
  mentions?: readonly MentionablePlayer[];
  /** The message being answered: who wrote it and how it starts, over the field, with the way to put the reply away. */
  replying?: { name: string; excerpt: string; onCancel: () => void };
}

const NO_MENTIONS: readonly MentionablePlayer[] = [];

export function MessageComposer({
  onSend,
  placeholder = "Type a message…",
  disabled = false,
  isSending = false,
  minLength = 1,
  maxLength = 2000,
  mentions = NO_MENTIONS,
  replying,
}: MessageComposerProps) {
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  // The "@" whose list was put away (a name picked, or Escape): it stays closed until another "@" is typed.
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  // A reply begun puts the keyboard in the field, to write it.
  const answering = replying && `${replying.name}\u0000${replying.excerpt}`;
  useEffect(() => {
    if (answering) inputRef.current?.focus();
  }, [answering]);

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

  // Where there is a map (in a game), the place selected on it can go with the message.
  const map = useChatMap();
  const [place, setPlace] = useState<SharedPlace | null>(null);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = draft.trim() || (place?.name ?? "");
      if (value.length < minLength) {
        return;
      }
      if (value.length > maxLength) {
        return;
      }
      try {
        await onSend(value, place);
        resetDraft();
        setPlace(null);
      } catch (sendError) {
        console.error("Failed to send message:", sendError);
      }
    },
    [draft, maxLength, minLength, onSend, place, resetDraft],
  );

  return (
    <form onSubmit={handleSubmit} className="flex flex-shrink-0 flex-col gap-1 p-1.5">
      {replying && (
        <div className="flex min-w-0 items-center gap-1.5 px-1 text-hud-label text-hud-muted">
          <span className="shrink-0 text-hud-accent">{replying.name}</span>
          <span className="min-w-0 flex-1 truncate">{replying.excerpt}</span>
          <HudIconButton
            icon="close"
            label={CHAT_WORDS.cancelReply}
            kind="quiet"
            size="sm"
            onClick={replying.onCancel}
          />
        </div>
      )}
      {place && (
        <div className="flex min-w-0 items-center gap-1.5 px-1">
          <PlaceChip place={place} />
          <HudIconButton
            icon="close"
            label={CHAT_WORDS.removePlace}
            kind="quiet"
            size="sm"
            onClick={() => setPlace(null)}
          />
        </div>
      )}
      <div className="flex space-x-1.5 relative">
        {map && (
          <HudIconButton
            icon="location"
            label={CHAT_WORDS.sharePlace}
            kind="quiet"
            disabled={!map.selected || disabled}
            onClick={() => {
              setPlace(map.selected);
              inputRef.current?.focus();
            }}
          />
        )}
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
      </div>
    </form>
  );
}
