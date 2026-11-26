import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { dayLeftCompact, DAY_BANNER_WORDS as WORDS } from "@/ui/design-system/kit/words";
import { toast } from "@/ui/features/event-feed/notify";
import { DAILY_QUEST_MODELS, type ExpeditionRules, readDailyQuest, UNROLLED_WORLD_DAY } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import { type AspectId, RESOURCE_PRECISION } from "@bibliothecadao/types";
import type { Account } from "starknet";
import { create } from "zustand";

import { dayClock } from "../hud/day-clock";
import { teacherAspectOf } from "../opening/opening";
import { baneBroken, type BaneFace, baneFace } from "./bane-face";
import { dayQuestFace } from "./day-quest-face";
import { type BaneStanding, QuestDockView } from "./quest-dock-view";

const useQuestDockState = create<{ open: boolean }>(() => ({ open: false }));

export const useQuestDockOpen = () => useQuestDockState((state) => state.open);
export const toggleQuestDock = () => useQuestDockState.setState((state) => ({ open: !state.open }));
export const closeQuestDock = () => useQuestDockState.setState({ open: false });

type QuestReading = NonNullable<NonNullable<ReturnType<typeof readDailyQuest>>["reading"]["known"]>;

export const questSpeaker = (reading: QuestReading | undefined): AspectId => {
  const moment = reading?.bane ? "bane" : "quest";
  const speaker = teacherAspectOf(moment, undefined);
  if (speaker === null) throw new Error(`The ${moment} lesson names no Aspect of its own`);
  return speaker;
};

export const QuestDock = ({
  realm,
  rules,
  layout,
}: {
  realm: NativeRows["Structure"];
  rules: ExpeditionRules;
  layout: "desktop" | "phone";
}) => {
  const { setup, account } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  const key = today ? `${realm.game_id}:${realm.entity_id}:${today.day}` : null;
  const collecting = useInFlight("quest", key) !== undefined;
  if (!today) return null;
  const reading = today.reading.known;
  const collect = () => {
    if (!reading || (reading.state !== "done" && reading.state !== "again") || key === null) return;
    return sendOnce("quest", key, true, () =>
      setup.systemCalls.claim_daily_quest({
        signer: account.account as unknown as Account,
        home: safeInteger(realm.entity_id),
        day: today.day,
      }),
    ).catch((error: unknown) => toast.failed(error, "The quest reward could not be collected."));
  };
  return (
    <QuestDockView
      layout={layout}
      speaker={questSpeaker(reading)}
      quest={reading ? dayQuestFace(reading.quest.id) : null}
      reading={reading ? questReading(reading) : null}
      undrawn={today.reading.unknown === UNROLLED_WORLD_DAY}
      bane={
        reading?.bane
          ? baneStanding(baneFace(reading.bane, setup.store, realm.game_id), reading.bane, rules, now)
          : null
      }
      collecting={collecting}
      onCollect={collect}
      onClose={closeQuestDock}
    />
  );
};

const questReading = (reading: QuestReading) => ({
  progress: safeInteger(reading.progress),
  target: safeInteger(reading.target),
  reward: {
    labor: Number(reading.reward.labor) / RESOURCE_PRECISION,
    essence: Number(reading.reward.essence) / RESOURCE_PRECISION,
  },
  state: reading.state,
});

const baneStanding = (
  face: BaneFace,
  bane: NonNullable<QuestReading["bane"]>,
  rules: ExpeditionRules,
  now: number,
): BaneStanding => ({
  ...face,
  standing: baneBroken(bane, now)
    ? WORDS.baneBroken
    : WORDS.baneProgress(bane.completed, bane.required, dayLeftCompact(dayClock(rules, now).secondsLeft)),
});
