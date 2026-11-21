import { expect, it } from "vitest";
import { NativeFactStore, nativeOathConstants as oaths } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { planDeepSiteWatches } from "./deep-site-watch";
import {
  ARMY,
  ARMIES_TICK_SECONDS,
  GAME_ID,
  PLAYER_ACCOUNT,
  TODAY,
  siteSnapshot,
  siteGuardTroops,
  snapshot,
} from "./fixtures/shard-world";

const player = { gameId: GAME_ID, actor: PLAYER_ACCOUNT, owner: PLAYER_ACCOUNT };

function equalArmies(lastTarget: number | undefined, guardTroops = siteGuardTroops(1)) {
  const timestamp = Math.floor(Date.now() / 1000);
  const bar = { amount: 120, settledAt: timestamp, day: TODAY };
  const facts = siteSnapshot(snapshot(bar, bar, null, [], null), {
    troops: guardTroops,
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

it.each([false, true])("uses held damage Oaths when planning a Deep alert, defending %s", (defending) => {
  const { store, timestamp } = equalArmies(0, defending ? siteGuardTroops(1, 600) : siteGuardTroops(1));
  const army = [...store.inGame("ExplorerTroops", GAME_ID)].find(({ explorer_id }) =>
    defending ? explorer_id !== BigInt(ARMY) : explorer_id === BigInt(ARMY),
  )!;
  const progress = store.require("ArmyProgress", army);
  store.applyFacts([
    {
      model: "ArmyProgress",
      key: store.wireKeyOf("ArmyProgress", army)!,
      value: {
        ...progress,
        oath_slots: 4,
        oaths: (1 << (oaths.POWER - 1)) | (1 << (oaths.GIANTS - 1)) | (defending ? 1 << (oaths.PROTECTION - 1) : 0),
      },
    },
  ]);
  const due = defending ? (Math.floor(timestamp / ARMIES_TICK_SECONDS) + 1) * ARMIES_TICK_SECONDS : timestamp;
  expect(planDeepSiteWatches(store, player, timestamp * 1000).map(({ dueAt }) => dueAt)).toEqual([due * 1000]);
});
