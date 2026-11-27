import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudButton } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from "react";

/** A finger dragged this far right on a message answers it, as a phone's chats do. */
const SWIPE_PX = 56;
/** Moved less than this, a press is a click or a tap. */
const TAP_PX = 8;

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
  run?: { name: string; time: string; onName?: () => void };
  /** The message this one answers. */
  quote?: { name: string; excerpt: string; onShow: () => void };
  mentionsMe?: boolean;
  /** Shown just now, from a reply's quote. */
  lit?: boolean;
  /** Answering it; none for a row that offers no Reply (a muted player's). */
  onReply?: () => void;
  children: ReactNode;
}) => {
  const [actions, setActions] = useState(false);
  const press = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const reply = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (actions) reply.current?.scrollIntoView?.({ block: "nearest" });
  }, [actions]);
  const onPointerDown = (event: PointerEvent) => {
    press.current = { x: event.clientX, y: event.clientY, touch: event.pointerType === "touch" };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = press.current;
    press.current = null;
    if (!start || (event.target as Element).closest("a, button")) return;
    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    if (start.touch && dx >= SWIPE_PX && dy < SWIPE_PX / 2) onReply?.();
    else if (Math.abs(dx) < TAP_PX && dy < TAP_PX) setActions((shown) => !shown);
  };

  return (
    <li
      data-message-id={id}
      data-mentions-me={mentionsMe || undefined}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      className={cn(
        "group rounded px-1 py-0.5 text-hud-body leading-snug text-hud-ink transition-colors",
        mentionsMe && "bg-hud-chosen",
        lit && "bg-hud-hover",
      )}
    >
      <div className="min-w-0">
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
        <p className="break-words">
          {run && (
            <span data-message-time className="mr-1.5 tabular-nums text-hud-label text-hud-cue">
              {run.time}
            </span>
          )}
          {run &&
            (run.onName ? (
              <button type="button" onClick={run.onName} className="mr-1.5 text-hud-strong text-hud-accent">
                {run.name}
              </button>
            ) : (
              <span className="mr-1.5 text-hud-strong text-hud-accent">{run.name}</span>
            ))}
          <span data-message-words>{children}</span>
        </p>
      </div>
      {onReply && (
        <div ref={reply} className={cn("justify-end pt-1 group-focus-within:flex", actions ? "flex" : "hidden")}>
          <HudButton kind="secondary" size="sm" onClick={onReply}>
            {CHAT_WORDS.reply}
          </HudButton>
        </div>
      )}
    </li>
  );
};
