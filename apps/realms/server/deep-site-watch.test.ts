import { expect, it } from "vitest";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { planDeepSiteWatches } from "./deep-site-watch";
import {
  ARMY,
  ARMIES_TICK_SECONDS,
  GAME_ID,
  PLAYER_ACCOUNT,
  TODAY,
  siteSnapshot,
  snapshot,
} from "./fixtures/shard-world";

const player = { gameId: GAME_ID, actor: PLAYER_ACCOUNT, owner: PLAYER_ACCOUNT };

function equalArmies(lastTarget: number | undefined) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bar = { amount: 120, settledAt: timestamp, day: TODAY };
  const facts = siteSnapshot(snapshot(bar, bar, null, [], "realm", null), {
    troops: 1000,
    aspect: 2,
    lore: true,
    lastTick: Math.floor(timestamp / ARMIES_TICK_SECONDS),
  });
  const armies = facts.models.find(({ model }) => model === "ExplorerTroops")!.rows;
  const opponent = Number(armies[1]!.value.explorer_id);
  const combat = facts.models.find(({ model }) => model === "ArmyCombat")!;
  combat.rows =
    lastTarget === undefined
      ? []
      : [
          {
            key: `0x${ARMY.toString(16)}`,
            value: {
              game_id: GAME_ID,
              explorer_id: ARMY,
              charge: 5,
              last_target: lastTarget === -1 ? opponent : lastTarget,
            },
          },
        ];
  const store = new NativeFactStore();
  store.applyFacts(facts.models.flatMap(({ model, rows }) => rows.map((row) => ({ model, ...row }))));
  const army = store.require("ExplorerTroops", { game_id: GAME_ID, explorer_id: ARMY });
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: `0x${ARMY.toString(16)}`,
      value: { ...army, troops: { ...army.troops, count: 1000n * BigInt(RESOURCE_PRECISION) } },
    },
  ]);
  store.setSnapshot({ gameId: GAME_ID, actor: PLAYER_ACCOUNT, complete: true, timestamp });
  return { store, timestamp };
}

it("plans a Deep site opportunity from the opening still available to this army", () => {
  const fresh = equalArmies(0);
  const spent = equalArmies(-1);
  expect(planDeepSiteWatches(fresh.store, player, fresh.timestamp * 1000).map(({ dueAt }) => dueAt)).toEqual([
    fresh.timestamp * 1000,
  ]);
  expect(planDeepSiteWatches(spent.store, player, spent.timestamp * 1000).map(({ dueAt }) => dueAt)).toEqual([
    (Math.floor(spent.timestamp / ARMIES_TICK_SECONDS) + 1) * ARMIES_TICK_SECONDS * 1000,
  ]);
});

it("does not plan a Deep site opportunity from an unknown opening", () => {
  const { store, timestamp } = equalArmies(undefined);
  expect(() => planDeepSiteWatches(store, player, timestamp * 1000)).toThrow(
    "Deep alert is missing the attacker's Charge fact",
  );
});
