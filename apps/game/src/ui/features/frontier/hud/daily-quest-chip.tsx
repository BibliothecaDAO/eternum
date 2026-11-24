import "./frontier-bar.css";

import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { Icon } from "@/ui/design-system/icon";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { DAILY_QUEST_MODELS, readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { formatShort } from "@bibliothecadao/types";

import { DailyQuest } from "../day/daily-quest";
import { dayQuestFace } from "../day/day-quest-face";
import { useHudPopover } from "./hud-popover";
import { ProgressRing } from "./progress-ring";

export const DailyQuestChip = ({ realm, look = "chip" }: { realm: NativeRows["Structure"]; look?: "chip" | "orb" }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const { triggerProps, popover, close } = useHudPopover();
  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  if (!today) return null;
  const reading = today.reading.known;
  const face = reading ? dayQuestFace(reading.quest.id) : null;
  const progress = reading ? safeInteger(reading.progress) : 0;
  const target = reading ? safeInteger(reading.target) : 0;
  const ready = reading?.state === "done" || reading?.state === "again";
  const count = reading ? `${formatShort(progress)}/${formatShort(target)}` : "—";
  const layout = look === "orb" ? "phone" : "desktop";
  const icon = face?.icon ?? "explore";

  return (
    <div className="frontier-quest-wrap pointer-events-auto">
      <button
        type="button"
        {...triggerProps}
        aria-haspopup="dialog"
        data-daily-quest-chip=""
        data-ready={ready || undefined}
        aria-label={face ? `${face.name} ${count}` : DAY_BANNER_WORDS.today}
        className={look === "orb" ? "frontier-quest-orb" : "frontier-quest-chip"}
      >
        {look === "orb" ? (
          <>
            <ProgressRing size="lg" share={target > 0 ? progress / target : 0} tone="calm">
              <Icon name={icon} size={24} />
            </ProgressRing>
            <span className="frontier-quest-orb__count">{ready ? DAY_BANNER_WORDS.collect : count}</span>
            {ready && (
              <span className="frontier-quest-orb__alert" aria-hidden="true">
                !
              </span>
            )}
          </>
        ) : (
          <>
            <Icon name={icon} size={16} />
            <span className="frontier-quest-chip__label">{DAY_BANNER_WORDS.quest}</span>
            <span className="frontier-quest-chip__count">{count}</span>
          </>
        )}
      </button>
      {popover(<DailyQuest realm={realm} layout={layout} onClose={close} />, {
        className: "frontier-quest-popover",
        layout,
      })}
    </div>
  );
};
