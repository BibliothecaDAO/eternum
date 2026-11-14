import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { sendOnce, useInFlight } from "@/hooks/store/use-actions-in-flight";
import { toast } from "@/ui/features/event-feed/notify";
import { DAILY_QUEST_MODELS, readDailyQuest } from "@bibliothecadao/eternum";
import { safeInteger, type NativeRows } from "@bibliothecadao/eternum/game-client";
import type { Account } from "starknet";
import { DayBannerView, type DayLayout } from "./day-banner-view";
import { dayQuestFace } from "./day-quest-face";

export const DailyQuest = ({ realm, layout }: { realm: NativeRows["Structure"]; layout: DayLayout }) => {
  const { setup, account } = useGame();
  const now = useNowSeconds();
  useNativeRevision(DAILY_QUEST_MODELS);
  const today = readDailyQuest(setup.store, realm.game_id, safeInteger(realm.entity_id), now);
  const key = today ? `${realm.game_id}:${realm.entity_id}:${today.day}` : null;
  const collecting = useInFlight("quest", key) !== undefined;
  if (!today) return null;
  const reading = today.reading.known;
  const collect = () => {
    if (!reading?.completed || reading.claimed || key === null) return;
    return sendOnce("quest", key, true, () =>
      setup.systemCalls.claim_daily_quest({
        signer: account.account as unknown as Account,
        home: safeInteger(realm.entity_id),
        day: today.day,
      }),
    ).catch((error: unknown) => toast.failed(error, "The quest reward could not be collected."));
  };
  return (
    <section data-daily-quest>
      <DayBannerView
        layout={layout}
        quest={dayQuestFace(today.id)}
        reading={
          reading
            ? {
                progress: safeInteger(reading.progress),
                target: safeInteger(reading.target),
                reward: { labor: safeInteger(reading.reward.labor), essence: safeInteger(reading.reward.essence) },
                state: reading.claimed ? "collected" : reading.completed ? "done" : "running",
              }
            : null
        }
        heads={[]}
        members={null}
        claim={null}
        collecting={collecting}
        onCollect={collect}
        onOpenClaim={collect}
      />
    </section>
  );
};
