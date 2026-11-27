import "./message-row.css";

import { cn } from "@/ui/design-system/atoms/lib/utils";
import { HudAspectName, HudButton } from "@/ui/design-system/kit/hud-elements";
import { CHAT_WORDS } from "@/ui/design-system/kit/words";
import type { AspectId } from "@bibliothecadao/types";
import { type MouseEvent, type PointerEvent, type ReactNode, useCallback, useEffect, useRef } from "react";

const SWIPE_PX = 56;
const MOVE_CANCEL_PX = 8;
const LONG_PRESS_MS = 450;

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
  run?: { name: string; aspect?: AspectId | null; time: string; onName?: () => void };
  quote?: { name: string; aspect?: AspectId | null; excerpt: string; onShow: () => void };
  mentionsMe?: boolean;
  lit?: boolean;
  onReply?: () => void;
  children: ReactNode;
}) => {
  const press = useRef<{ x: number; y: number; triggered: boolean } | null>(null);
  const suppressContextMenu = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return clearHold;
  }, [clearHold]);

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || !onReply || (event.target as Element).closest("a, button")) return;
    clearHold();
    suppressContextMenu.current = false;
    const state = { x: event.clientX, y: event.clientY, triggered: false };
    press.current = state;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (press.current !== state) return;
      state.triggered = true;
      suppressContextMenu.current = true;
      window.getSelection?.()?.removeAllRanges?.();
      onReply();
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: PointerEvent) => {
    const start = press.current;
    if (!start) return;
    if (Math.abs(event.clientX - start.x) >= MOVE_CANCEL_PX || Math.abs(event.clientY - start.y) >= MOVE_CANCEL_PX) {
      clearHold();
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    clearHold();
    const start = press.current;
    press.current = null;
    if (!start || start.triggered || !onReply) return;
    const dx = event.clientX - start.x;
    const dy = Math.abs(event.clientY - start.y);
    if (dx >= SWIPE_PX && dy < SWIPE_PX / 2) onReply();
  };

  const onPointerCancel = () => {
    clearHold();
    press.current = null;
  };

  const onContextMenu = (event: MouseEvent) => {
    if (press.current || suppressContextMenu.current) {
      suppressContextMenu.current = false;
      event.preventDefault();
    }
  };

  return (
    <li
      data-message-id={id}
      data-mentions-me={mentionsMe || undefined}
      data-lit={lit || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onContextMenu}
      className={cn(
        "chat-message-row group relative rounded px-1 py-0.5 text-hud-body leading-snug text-hud-ink transition-colors",
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
            <HudAspectName aspect={quote.aspect ?? null} className="shrink-0">
              {quote.name}
            </HudAspectName>
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
              <button type="button" onClick={run.onName} className="mr-1.5 text-hud-strong">
                <HudAspectName aspect={run.aspect ?? null}>{run.name}</HudAspectName>
              </button>
            ) : (
              <HudAspectName aspect={run.aspect ?? null} className="mr-1.5 text-hud-strong">
                {run.name}
              </HudAspectName>
            ))}
          <span data-message-words>{children}</span>
        </p>
      </div>
      {onReply && (
        <span className="chat-message-row__reply">
          <HudButton kind="secondary" size="sm" onClick={onReply}>
            {CHAT_WORDS.reply}
          </HudButton>
        </span>
      )}
    </li>
  );
};
