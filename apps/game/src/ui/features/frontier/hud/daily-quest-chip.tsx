import "./frontier-bar.css";

import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { Icon } from "@/ui/design-system/icon";
import { aspectMeaning } from "@/ui/design-system/icon-meaning";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { DAILY_QUEST_MODELS, readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { baneFace } from "../day/bane-face";
import { dayQuestFace } from "../day/day-quest-face";
import { questSpeaker, toggleQuestDock, useQuestDockOpen } from "../day/quest-dock";
import { ProgressRing } from "./progress-ring";

/**
 * Today's quest in the top bar: its painting in a ring that fills as the quest does, its name, what it asks and its
 * count. On a bane day it is the bane's: the speaking Aspect's mark in the same one ring, the word Bane and its name.
 * A press opens the quest's dock.
 */
export const DailyQuestChip = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const open = useQuestDockOpen();
  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  if (!today) return null;
  const reading = today.reading.known;
  const face = reading ? dayQuestFace(reading.quest.id) : null;
  const progress = reading ? safeInteger(reading.progress) : 0;
  const target = reading ? safeInteger(reading.target) : 0;
  const ready = reading?.state === "done" || reading?.state === "again";
  const count = reading ? DAY_BANNER_WORDS.fraction(progress, target) : "—";
  const bane = reading?.bane ? baneFace(reading.bane, setup.store, realm.game_id) : null;
  const icon = bane ? aspectMeaning(questSpeaker(reading)) : (face?.icon ?? "explore");
  const tag = ready ? DAY_BANNER_WORDS.collect : bane ? DAY_BANNER_WORDS.bane : count;

  return (
    <div className="frontier-quest-wrap pointer-events-auto">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        data-daily-quest-chip=""
        data-hud-part=""
        data-ready={ready || undefined}
        data-tone={bane ? "bane" : undefined}
        aria-label={
          bane ? `${DAY_BANNER_WORDS.bane}: ${bane.name}` : face ? `${face.name} ${count}` : DAY_BANNER_WORDS.today
        }
        className="frontier-quest-orb"
        onClick={toggleQuestDock}
      >
        <ProgressRing size="lg" share={target > 0 ? progress / target : 0} tone={bane ? "ember" : "calm"}>
          <Icon name={icon} size={36} />
        </ProgressRing>
        <span className="frontier-quest-orb__count">{tag}</span>
        {bane ? (
          <span className="frontier-quest-orb__words">
            <span className="frontier-quest-orb__name">{bane.name}</span>
          </span>
        ) : (
          face &&
          reading && (
            <span className="frontier-quest-orb__words">
              <span className="frontier-quest-orb__name">{face.name}</span>
              <span className="frontier-quest-orb__objective">
                {DAY_BANNER_WORDS.objectiveLine(face.objective, target)}
              </span>
            </span>
          )
        )}
        {ready && (
          <span className="frontier-quest-orb__alert" aria-hidden="true">
            !
          </span>
        )}
      </button>
    </div>
  );
};
