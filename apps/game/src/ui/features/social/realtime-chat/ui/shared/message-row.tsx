import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { type PointerEvent, type ReactNode, useRef, useState } from "react";

import { UserAvatar } from "./user-avatar";

/** A finger dragged this far right on a message answers it, as a phone's chats do. */
const SWIPE_PX = 56;
/** Moved less than this, a press is a click or a tap. */
const TAP_PX = 8;

/**
 * One message in a room or a conversation. The first of a sender's run carries their portrait, their name and the time;
 * the rest of the run sits under it. A reply carries one line over it: who it answers and the start of what they said,
 * pressed to show that message. A message naming the reader is lit.
 *
 * Reply stands at its end once the message is clicked or tapped (the next click or tap puts it away), or while the
 * keyboard is in it. On a phone, a swipe right answers at once.
 */
export const MessageRow = ({
  id,
  run,
  quote,
  mentionsMe = false,
  lit = false,
  onReply,
  children,
}: {
  id: string;
  /** The run's head: who wrote it and when; none for a message within a run. */
  run?: { name: string; playerId: string; avatarUrl?: string; time: string; onName?: () => void };
  /** The message this one answers. */
  quote?: { name: string; excerpt: string; onShow: () => void };
  mentionsMe?: boolean;
  /** Shown just now, from a reply's quote. */
  lit?: boolean;
  onReply: () => void;
  children: ReactNode;
}) => {
  const [actions, setActions] = useState(false);
  const press = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    press.current = { x: event.clientX, y: event.clientY, touch: event.pointerType === "touch" };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || (event.target as Element).closest("a, button")) return;
    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    if (start.touch && dx >= SWIPE_PX && dy < SWIPE_PX / 2) onReply();
    else if (Math.abs(dx) < TAP_PX && dy < TAP_PX) setActions((shown) => !shown);
  };

  return (
    <li
      data-message-id={id}
      data-mentions-me={mentionsMe || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn(
        "group relative flex gap-2 rounded px-1 py-0.5 text-hud-body leading-snug text-hud-ink transition-colors",
        run && "mt-1.5",
        mentionsMe && "bg-hud-chosen",
        lit && "bg-hud-hover",
      )}
    >
      <span className="w-6 shrink-0">
        {run && (
          <UserAvatar name={run.name} address={run.playerId} avatarUrl={run.avatarUrl} size="sm" className="mt-0.5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        {quote && (
          <button
            type="button"
            onClick={quote.onShow}
            className="flex w-full min-w-0 items-center gap-1 text-left text-hud-label text-hud-muted"
          >
            <span aria-hidden className="h-2 w-3 shrink-0 rounded-tl border-l-2 border-t-2 border-hud-line-strong" />
            <span className="shrink-0 text-hud-accent">{quote.name}</span>
            <span className="truncate">{quote.excerpt}</span>
          </button>
        )}
        {run && (
          <p className="flex items-baseline gap-2">
            {run.onName ? (
              <button type="button" onClick={run.onName} className="text-hud-strong text-hud-accent">
                {run.name}
              </button>
            ) : (
              <span className="text-hud-strong text-hud-accent">{run.name}</span>
            )}
            <span className="text-hud-label text-hud-cue">{run.time}</span>
          </p>
        )}
        <p className="break-words">{children}</p>
      </div>
      <span className={cn("absolute right-1 top-0 group-focus-within:flex", actions ? "flex" : "hidden")}>
        <HudButton kind="secondary" size="sm" onClick={onReply}>
          {CHAT_WORDS.reply}
        </HudButton>
      </span>
    </li>
  );
};
