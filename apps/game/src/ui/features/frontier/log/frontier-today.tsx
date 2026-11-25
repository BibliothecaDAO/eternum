import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import type { readExpeditionRules } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";

import { dayBounds, dayClock, seasonDay } from "../hud/day-clock";

import { useDayShare } from "../rollover/day-share-sheet";
import { usePartShown } from "../opening/opening-context";
import { readQuestWeek } from "./quest-week";
import { useGloryHeld } from "./day-gains";
import { usePlayerDay } from "./player-day";
import { TodaySheet } from "./today-sheet";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

export const FrontierToday = ({
  rules,
  realm,
  own,
  onClose,
}: {
  rules: ExpeditionRules;
  realm: NativeRows["Structure"] | null;
  own?: boolean;
  onClose: () => void;
}) => {
  const { setup } = useGame();
  const now = useNowSeconds();
  const player = realm ? `0x${BigInt(realm.owner).toString(16)}` : null;
  const clock = dayClock(rules, now);
  const season = seasonDay(rules, now);
  const today = clock.day;
  const yesterday = today !== undefined && today > 1 ? today - 1 : undefined;
  const played = usePlayerDay(player, today === undefined ? null : dayBounds(rules, now, today));
  const playedYesterday = usePlayerDay(player, yesterday === undefined ? null : dayBounds(rules, now, yesterday));
  const recap = useDayShare(realm, yesterday, playedYesterday);
  const weekShown = usePartShown("today");
  const glory = useGloryHeld(realm);
  return (
    <>
      <TodaySheet
        day={today}
        lastDay={season?.lastDay}
        clock={clock}
        week={
          own && realm && today !== undefined && weekShown
            ? readQuestWeek(setup.store, realm.game_id, realm.entity_id, today - 1)
            : undefined
        }
        gains={{ essence: played.totals.essence, labor: played.totals.labor, glory }}
        onRecap={recap.onShare}
        onClose={onClose}
      />
      {recap.sheet}
    </>
  );
};
