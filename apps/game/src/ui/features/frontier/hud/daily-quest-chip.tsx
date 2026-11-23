import "./frontier-bar.css";

import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { Icon } from "@/ui/design-system/icon";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { DAILY_QUEST_MODELS, readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort } from "@bibliothecadao/types";
import { useEffect, useRef, useState } from "react";

import { DailyQuest } from "../day/daily-quest";
import { dayQuestFace } from "../day/day-quest-face";

export const DailyQuestChip = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={wrapRef} className="frontier-quest-wrap">
      <button
        type="button"
        data-daily-quest-chip=""
        data-ready={ready || undefined}
        aria-label={face ? `${face.name} ${count}` : DAY_BANNER_WORDS.today}
        aria-expanded={open}
        className="frontier-quest-chip"
        onClick={() => setOpen((was) => !was)}
      >
        <Icon name={face?.icon ?? "explore"} size={18} />
        <span>{count}</span>
      </button>
      {open && (
        <div className="frontier-quest-popover">
          <DailyQuest realm={realm} layout="desktop" />
        </div>
      )}
    </div>
  );
};
