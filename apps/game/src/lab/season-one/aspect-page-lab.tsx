import { useSearchParams } from "react-router-dom";

import { expiredRaceScenario, raceScenario } from "@/lab/game/race-scenario";
import { seasonBoard } from "@/ui/features/frontier/aspect/aspect-page";
import { SeasonLeaderboard } from "@/ui/features/frontier/aspect/season-leaderboard";
import { getStructureName } from "@bibliothecadao/eternum";
import { readRaceBoard } from "@bibliothecadao/eternum/game-client";

const CASES = {
  live: () => raceScenario(),
  finished: () => raceScenario(true),
  expired: () => expiredRaceScenario(),
};
const NAMES = Object.keys(CASES) as (keyof typeof CASES)[];

const boardOf = (name: keyof typeof CASES) => {
  const { store, player, startsAt } = CASES[name]();
  store.setSnapshot({ gameId: 1, actor: player, timestamp: startsAt, complete: true });
  const home = store.require("Structure", { game_id: 1, entity_id: 7 });
  const reading = readRaceBoard(store, 1, home.entity_id);
  const board = reading.known?.race;
  if (!board) throw new Error(`The ${name} race scenario holds no race: ${reading.unknown ?? "no race rules"}`);
  return seasonBoard(
    board,
    home,
    (realm) => getStructureName(realm, store).name,
    true,
    (entity) => {
      const realm = store.get("Structure", { game_id: 1, entity_id: entity });
      return realm ? { owner: `0x${realm.owner.toString(16)}`, realm_id: Number(realm.metadata.realm_id) } : null;
    },
  );
};

export function AspectPageLab() {
  const [params, setParams] = useSearchParams();
  const index = Math.min(Number(params.get("case") ?? 0) || 0, NAMES.length - 1);
  return (
    <div data-aspect-page className="flex flex-col gap-2 p-3">
      <nav className="flex flex-wrap gap-2">
        {NAMES.map((name, each) => (
          <button key={name} aria-pressed={each === index} onClick={() => setParams({ case: String(each) })}>
            {name}
          </button>
        ))}
      </nav>
      <SeasonLeaderboard
        {...boardOf(NAMES[index]!)}
        day={{ day: 6, lastDay: 50 }}
        goToDeep={{ go: () => undefined }}
        onClose={() => setParams({ case: "0" })}
      />
    </div>
  );
}
