import { expect, it } from "vitest";
import { deepScenario } from "@/lab/game/deep-scenario";
import { planDeepSiteWatches } from "../../../../../../realms/server/deep-site-watch";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";
import { type NativeModelName, type NativeRows } from "@bibliothecadao/eternum/game-client";

function fixture(guardCounts = [1000]) {
  const { store, startsAt, player } = deepScenario();
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const slot = store.require("ArmySlot", { game_id: 1, structure_id: army.owner, epoch: 0n, slot: 0 });
  const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  let key = 0x9000;
  const write = <M extends NativeModelName>(model: M, row: NativeRows[M]) => {
    store.applyFacts([{ model, key: store.wireKeyOf(model, row) ?? `0x${(key++).toString(16)}`, value: row }]);
  };
  const change = <M extends NativeModelName>(
    model: M,
    keys: Parameters<typeof store.require<M>>[1],
    changes: Partial<NativeRows[M]>,
  ) => {
    store.applyFacts([
      { model, key: store.wireKeyOf(model, keys)!, value: { ...store.require(model, keys), ...changes } },
    ]);
  };
  store.applyFacts([
    { model: "DeepArmy", key: store.wireKeyOf("DeepArmy", { game_id: 1, explorer_id: 201 })!, value: null },
  ]);
  const position = store.entityOccupancy(1, 201)!;
  store.applyFacts([{ model: "TileOccupancy", key: store.wireKeyOf("TileOccupancy", position)!, value: null }]);
  write("TileOccupancy", { ...position, col: 50, row: 50 });
  change(
    "ExplorerTroops",
    { game_id: 1, explorer_id: 201 },
    { troops: { ...army.troops, count: 1500n * BigInt(RESOURCE_PRECISION) } },
  );
  change(
    "ArmySlot",
    { game_id: 1, structure_id: army.owner, epoch: 0n, slot: 0 },
    { stamina: { amount: 120n, settled_at: startsAt, remainder: 0 } },
  );
  change("HomeAspect", { game_id: 1, home: 9 }, { aspect: 2 });
  const guard = store.require("ExplorerTroops", { game_id: 1, explorer_id: 301 });
  const membership = store.require("DeepGuard", { game_id: 1, explorer_id: 301 });
  const entered = store.require("DeepArmy", { game_id: 1, explorer_id: 301 });
  for (const [index, count] of guardCounts.entries()) {
    const explorer_id = 301n + BigInt(index);
    const troops = { ...guard.troops, count: BigInt(count) * BigInt(RESOURCE_PRECISION), stamina: { Slot: index } };
    if (index === 0) change("ExplorerTroops", { game_id: 1, explorer_id }, { troops });
    else {
      write("ExplorerTroops", { ...guard, explorer_id, troops });
      write("ArmyDay", { game_id: 1, explorer_id, day: 0n });
      write("DeepGuard", { ...membership, explorer_id, slot: index });
      write("DeepArmy", { ...entered, explorer_id });
    }
    write("ArmySlot", {
      ...slot,
      structure_id: guard.owner,
      slot: index,
      explorer_id,
      stamina: { amount: 120n, settled_at: startsAt, remainder: 0 },
    });
    write("ArmyProgress", { ...progress, explorer_id });
  }
  store.setSnapshot({ gameId: 1, actor: player, complete: true, timestamp: startsAt });
  const owner = { gameId: 1, actor: player, owner: "0x123", home: String(army.owner) };
  return {
    store,
    startsAt,
    owner,
    write,
    change,
    plan: (at = startsAt) => planDeepSiteWatches(store, owner, at * 1000),
  };
}

it("forecasts every rival guard in order with the same surviving attacker", () => {
  const single = fixture();
  expect(single.plan()).toHaveLength(1);
  const tickSeconds = Number(single.store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  expect(single.plan()[0]!.dueAt).toBe((Math.floor(single.startsAt / tickSeconds) + 1) * tickSeconds * 1000);
  const pair = fixture([1000, 1000]);
  const watches = pair.plan();
  expect(watches).toHaveLength(1);
  expect(watches[0]!.dueAt).toBeGreaterThan(pair.startsAt * 1000);
  expect(pair.plan(watches[0]!.dueAt / 1000)[0]!.dueAt).toBe(watches[0]!.dueAt);
  expect(pair.store.require("ExplorerTroops", { game_id: 1, explorer_id: 301 }).troops.count).toBe(
    1000n * BigInt(RESOURCE_PRECISION),
  );
});

it("does not offer allied sites, beasts, a realm without lore, or an army already in the Deep", () => {
  const allied = fixture();
  allied.change("HomeAspect", { game_id: 1, home: 9 }, { aspect: 1 });
  expect(allied.plan()).toEqual([]);
  const noLore = fixture();
  noLore.change("RealmKnowledge", { game_id: 1, structure_id: BigInt(noLore.owner.home) }, { learned: 0n });
  expect(noLore.plan()).toEqual([]);
  for (const depth of [1n, 2n]) {
    const shallow = fixture();
    shallow.change(
      "RealmKnowledge",
      { game_id: 1, structure_id: BigInt(shallow.owner.home) },
      { learned: depth << 48n },
    );
    expect(shallow.plan()).toEqual([]);
  }
  const entered = fixture();
  entered.store.applyFacts([
    { model: "DeepArmy", key: "0xa001", value: { game_id: 1, explorer_id: 201, last_tick: 0 } },
  ]);
  expect(entered.plan()).toEqual([]);
  const beasts = fixture();
  const watch = beasts.plan()[0]!;
  const guard = beasts.store.require("Guard", { game_id: 1, structure_id: BigInt(watch.siteId), slot: 0 });
  beasts.change(
    "Guard",
    { game_id: 1, structure_id: BigInt(watch.siteId), slot: 0 },
    { troops: { ...guard.troops, count: 1n } },
  );
  expect(beasts.plan()).toEqual([]);
});

it("does not promise a site whose last rival guard expires before the army can clear it", () => {
  const tiny = fixture([400]);
  const army = tiny.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  tiny.change(
    "ExplorerTroops",
    { game_id: 1, explorer_id: 201 },
    { troops: { ...army.troops, count: BigInt(RESOURCE_PRECISION) } },
  );
  expect(tiny.plan()).toEqual([]);
});

it("clears four weak slots without resetting the attacker and closes the watch at day end", () => {
  const four = fixture([100, 100, 100, 100]);
  const watches = four.plan();
  expect(watches).toHaveLength(1);
  expect(watches[0]!.dueAt).toBe(four.startsAt * 1000);
  expect(four.plan(watches[0]!.until / 1000)).toEqual([]);
});

it("uses the largest army across all of the player's homes without substituting a smaller eligible army", () => {
  const f = fixture();
  const army = f.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const home = f.store.require("Structure", { game_id: 1, entity_id: army.owner });
  const slot = f.store.require("ArmySlot", { game_id: 1, structure_id: army.owner, epoch: 0n, slot: 0 });
  const progress = f.store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  f.write("Structure", { ...home, entity_id: 12n });
  f.write("HomeAspect", { game_id: 1, home: 12n, aspect: 1 });
  f.write("RealmKnowledge", { game_id: 1, structure_id: 12n, learned: 0n });
  f.write("ExplorerTroops", {
    ...army,
    explorer_id: 202n,
    owner: 12n,
    troops: { ...army.troops, count: 2000n * BigInt(RESOURCE_PRECISION) },
  });
  f.write("ArmySlot", { ...slot, structure_id: 12n, explorer_id: 202n });
  f.write("ArmyProgress", { ...progress, explorer_id: 202n });
  f.write("ArmyCombat", { game_id: 1, explorer_id: 202n, last_target: 0n });
  f.write("ArmyDay", { game_id: 1, explorer_id: 202n, day: 0n });
  f.write("TileOccupancy", { ...f.store.entityOccupancy(1, 201)!, entity_id: 202n, row: 51 });
  expect(f.plan()).toEqual([]);
  f.change("RealmKnowledge", { game_id: 1, structure_id: 12n }, { learned: 3n << 48n });
  expect(f.plan()).toHaveLength(1);
  expect(f.plan()[0]!.home).toBe("12");
});

it("forecasts the same opportunity regardless of the last attacked guard", () => {
  const f = fixture([1000, 1]);
  const rules = f.store.require("SliceRules", { game_id: 1 });
  f.change(
    "SliceRules",
    { game_id: 1 },
    {
      troop_stamina_config: { ...rules.troop_stamina_config, stamina_attack_req: 10 },
    },
  );
  const key = { game_id: 1, explorer_id: 201n };
  const army = f.store.require("ExplorerTroops", key);
  f.change("ExplorerTroops", key, { troops: { ...army.troops, count: 1000n * BigInt(RESOURCE_PRECISION) } });
  f.change("ArmyCombat", key, { last_target: 301n });
  const due = f.plan().map(({ dueAt }) => dueAt);
  expect(due).toEqual([360000]);
  expect(f.store.require("ArmyCombat", key).last_target).toBe(301n);
  f.change("ArmyCombat", key, { last_target: 302n });
  expect(f.plan().map(({ dueAt }) => dueAt)).toEqual(due);
});
