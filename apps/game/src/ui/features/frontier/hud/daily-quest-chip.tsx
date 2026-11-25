import "./frontier-bar.css";

import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { Icon } from "@/ui/design-system/icon";
import { DAY_BANNER_WORDS } from "@/ui/design-system/kit/words";
import { useHudLayout } from "@/hooks/helpers/use-compact-hud";
import { DAILY_QUEST_MODELS, readDailyQuest, UNROLLED_WORLD_DAY } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";

import { baneFace, useBaneToday } from "../day/bane-face";
import { dayQuestFace } from "../day/day-quest-face";
import { questSpeaker, toggleQuestDock, useQuestDockOpen } from "../day/quest-dock";
import { resolveAspectEmissary } from "../tutorial/aspect-emissaries";
import { ProgressRing } from "./progress-ring";

export const DailyQuestChip = ({ realm }: { realm: NativeRows["Structure"] }) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const open = useQuestDockOpen();
  const desktop = useHudLayout() === "desktop";
  const baneToday = useBaneToday(realm);
  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  if (!today) return null;
  const reading = today.reading.known;
  const face = reading ? dayQuestFace(reading.quest.id) : null;
  const progress = reading ? safeInteger(reading.progress) : 0;
  const target = reading ? safeInteger(reading.target) : 0;
  const ready = reading?.state === "done" || reading?.state === "again";
  const count = reading ? DAY_BANNER_WORDS.fraction(progress, target) : "—";
  const bane = reading?.bane ? baneFace(reading.bane, setup.store, realm.game_id) : null;
  const undrawn = today.reading.unknown === UNROLLED_WORLD_DAY;
  const icon = bane ? bane.icon : undrawn ? "hourglass" : resolveAspectEmissary(questSpeaker(reading)).portrait;
  const share = reading?.bane ? breakShare(reading.bane) : target > 0 ? progress / target : 0;
  const tag = bane
    ? DAY_BANNER_WORDS.bane
    : undrawn
      ? DAY_BANNER_WORDS.undrawnTag
      : ready && !desktop
        ? DAY_BANNER_WORDS.collect
        : null;

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
        data-undrawn={undrawn || undefined}
        data-tip={baneToday?.line ?? (bane ? DAY_BANNER_WORDS.baneBroken : undefined)}
        aria-label={
          bane
            ? `${DAY_BANNER_WORDS.bane}: ${bane.name}`
            : face
              ? `${face.name} ${count}`
              : undrawn
                ? `${DAY_BANNER_WORDS.undrawnTitle}: ${DAY_BANNER_WORDS.undrawnPill}`
                : DAY_BANNER_WORDS.today
        }
        className="frontier-quest-orb"
        onClick={toggleQuestDock}
      >
        <ProgressRing size="lg" share={share} tone={bane ? "ember" : "calm"}>
          <Icon name={icon} size={36} />
        </ProgressRing>
        {tag && <span className="frontier-quest-orb__count">{tag}</span>}
        {bane ? (
          <span className="frontier-quest-orb__words" data-stacked="">
            <span className="frontier-quest-orb__kicker">{DAY_BANNER_WORDS.bane}</span>
            <span className="frontier-quest-orb__name">{bane.name}</span>
          </span>
        ) : undrawn ? (
          <span className="frontier-quest-orb__words" data-stacked="">
            <span className="frontier-quest-orb__kicker">{DAY_BANNER_WORDS.quest}</span>
            <span className="frontier-quest-orb__name">{DAY_BANNER_WORDS.undrawnPill}</span>
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

const breakShare = ({ completed, required }: { completed: number; required: number }) =>
  required > 0 ? completed / required : 1;
