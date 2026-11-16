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
  const rules = store.require("SliceRules", { game_id: GAME_ID });
  store.applyFacts([
    {
      model: "SliceRules",
      key: store.wireKeyOf("SliceRules", rules)!,
      value: { ...rules, troop_stamina_config: { ...rules.troop_stamina_config, stamina_attack_req: 10 } },
    },
  ]);
  return { store, timestamp };
}

it.each([0, -1, undefined])("plans an exact Deep opportunity independently of last target %s", (lastTarget) => {
  const { store, timestamp } = equalArmies(lastTarget);
  expect(planDeepSiteWatches(store, player, timestamp * 1000).map(({ dueAt }) => dueAt)).toEqual([
    (Math.floor(timestamp / ARMIES_TICK_SECONDS) + 1) * ARMIES_TICK_SECONDS * 1000,
  ]);
});
