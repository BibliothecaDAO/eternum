import "./frontier-bar.css";

import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { Icon } from "@/ui/design-system/icon";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { DAILY_QUEST_MODELS, readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort } from "@bibliothecadao/types";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { DailyQuest } from "../day/daily-quest";
import { dayQuestFace } from "../day/day-quest-face";
import { ProgressRing } from "./progress-ring";

const QUEST_POPOVER_GAP = 8;

export const questPopoverAnchor = (
  trigger: Pick<DOMRect, "left" | "bottom" | "width">,
): { x: number; top: number } => ({
  x: Math.round(trigger.left + trigger.width / 2),
  top: Math.round(trigger.bottom + QUEST_POPOVER_GAP),
});

export const DailyQuestChip = ({
  realm,
  layout = "desktop",
}: {
  realm: NativeRows["Structure"];
  layout?: "desktop" | "phone";
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; top: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const update = () => {
      const trigger = chipRef.current?.getBoundingClientRect();
      if (!trigger) return;
      setAnchor(questPopoverAnchor(trigger));
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const inChip = Boolean(wrapRef.current?.contains(target));
      const inPopover = Boolean(popoverRef.current?.contains(target));
      if (!inChip && !inPopover) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  if (!today) return null;
  const reading = today.reading.known;
  const face = reading ? dayQuestFace(reading.quest.id) : null;
  const progress = reading ? safeInteger(reading.progress) : 0;
  const target = reading ? safeInteger(reading.target) : 0;
  const ready = reading?.state === "done" || reading?.state === "again";
  const count = reading ? `${formatShort(progress)}/${formatShort(target)}` : "—";
  const popoverStyle: CSSProperties | undefined = anchor
    ? ({ "--quest-x": `${anchor.x}px`, "--quest-top": `${anchor.top}px` } as CSSProperties)
    : undefined;

  return (
    <div ref={wrapRef} className="frontier-quest-wrap pointer-events-auto">
      <button
        ref={chipRef}
        type="button"
        data-daily-quest-chip=""
        data-ready={ready || undefined}
        aria-label={face ? `${face.name} ${count}` : DAY_BANNER_WORDS.today}
        aria-expanded={open}
        className={layout === "desktop" ? "frontier-quest-orb" : "frontier-quest-chip"}
        onClick={() => setOpen((was) => !was)}
      >
        {layout === "desktop" ? (
          <>
            <ProgressRing size="lg" share={target > 0 ? progress / target : undefined} tone="calm">
              <Icon name={face?.icon ?? "explore"} size={22} />
            </ProgressRing>
            <span className="frontier-quest-orb__count">{ready ? DAY_BANNER_WORDS.collect : count}</span>
          </>
        ) : (
          <>
            <Icon name={face?.icon ?? "explore"} size={16} />
            <span className="frontier-quest-chip__label">{DAY_BANNER_WORDS.quest}</span>
            <span className="frontier-quest-chip__count">{count}</span>
          </>
        )}
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="ui frontier-quest-popover pointer-events-auto"
            data-layout={layout}
            style={popoverStyle}
          >
            <DailyQuest realm={realm} layout={layout} />
          </div>,
          document.body,
        )}
    </div>
  );
};
