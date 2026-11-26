import { siteGuardTroops } from "../../../../../../realms/server/fixtures/shard-world";
import { expect, it } from "vitest";
import { deepScenario, HELD_SITE } from "@/lab/game/deep-scenario";
import { planDeepRingOpenings, planDeepSiteWatches } from "../../../../../../realms/server/deep-site-watch";
import { deepSites, RESOURCE_PRECISION } from "@bibliothecadao/types";
import {
  nativeRuleConstants,
  readDeepSites,
  type NativeModelName,
  type NativeRows,
} from "@bibliothecadao/eternum/game-client";

const HELD = deepSites.find(({ key }) => key === HELD_SITE)!;

function fixture(guardCounts = [siteGuardTroops(1)]) {
  const { store, startsAt, player } = deepScenario();
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  let key = 0x9000;
  const write = <M extends NativeModelName>(
    model: M,
    row: NativeRows[M] & Parameters<typeof store.wireKeyOf<M>>[1],
  ) => {
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
  const mine = [...store.inGame("GarrisonSlot", 1)][0]!;
  const site = { game_id: 1, entity_id: mine.structure_id };
  const held = store.require("Guard", { game_id: 1, structure_id: mine.structure_id, slot: mine.slot });
  const rival = store.require("Structure", { game_id: 1, entity_id: mine.home });
  store.applyFacts([
    { model: "GarrisonSlot", key: store.wireKeyOf("GarrisonSlot", mine)!, value: null },
    { model: "Guard", key: store.wireKeyOf("Guard", held)!, value: null },
  ]);
  change("DeepSite", site, { aspect: 2 });
  change("Structure", site, { owner: rival.owner });
  for (const [index, count] of guardCounts.entries()) {
    const slot = nativeRuleConstants.DEEP_GUARD_SLOTS - 1 - index;
    const troops = { ...held.troops, count: BigInt(count) * BigInt(RESOURCE_PRECISION) };
    const home = index === 0 ? mine.home : BigInt(90 + index);
    if (index > 0) {
      write("Structure", { ...rival, entity_id: home, owner: rival.owner + BigInt(index) });
      write("HomeAspect", { game_id: 1, home, aspect: 2 });
    }
    write("Guard", { ...held, slot, troops });
    write("GarrisonSlot", { ...mine, slot, home });
  }
  store.setSnapshot({ gameId: 1, actor: player, complete: true, timestamp: startsAt });
  const owner = { gameId: 1, actor: player, owner: "0x123", home: String(army.owner) };
  return {
    store,
    startsAt,
    owner,
    site,
    write,
    change,
    plan: (at = startsAt) => planDeepSiteWatches(store, owner, at * 1000),
    rings: (at = startsAt) => planDeepRingOpenings(store, owner, at * 1000),
  };
}

it("forecasts every rival garrison in order with the same surviving attacker", () => {
  const single = fixture();
  expect(single.plan()).toHaveLength(1);
  const tickSeconds = Number(single.store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  expect(single.plan()[0]!.dueAt).toBe((Math.floor(single.startsAt / tickSeconds) + 1) * tickSeconds * 1000);
  const pair = fixture([siteGuardTroops(1), siteGuardTroops(1)]);
  const watches = pair.plan();
  expect(watches).toHaveLength(1);
  expect(watches[0]!.dueAt).toBeGreaterThan(pair.startsAt * 1000);
  expect(pair.plan(watches[0]!.dueAt / 1000)[0]!.dueAt).toBe(watches[0]!.dueAt);
  expect(pair.store.require("Guard", { game_id: 1, structure_id: pair.site.entity_id, slot: 3 }).troops.count).toBe(
    BigInt(siteGuardTroops(1)) * BigInt(RESOURCE_PRECISION),
  );
});

it("does not offer allied sites, beasts, a realm without lore, or an army already in the Deep", () => {
  const allied = fixture();
  allied.change("DeepSite", allied.site, { aspect: 1 });
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
  const guard = [...beasts.store.inGame("Guard", 1)].find((row) => row.slot === 0)!;
  ungarrison(beasts);
  beasts.change("DeepSite", beasts.site, { aspect: 0 });
  beasts.change("Structure", beasts.site, { owner: 0n });
  beasts.write("Guard", { ...guard, structure_id: beasts.site.entity_id, troops: { ...guard.troops, count: 1n } });
  expect(beasts.plan()).toEqual([]);
});

it("promises a site at the tick its last rival garrison drains out when the army could not beat it sooner", () => {
  const tiny = fixture([400]);
  const army = tiny.store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  tiny.change(
    "ExplorerTroops",
    { game_id: 1, explorer_id: 201 },
    { troops: { ...army.troops, count: BigInt(RESOURCE_PRECISION) } },
  );
  const [watch] = tiny.plan();
  const tickSeconds = Number(tiny.store.require("SliceRules", { game_id: 1 }).tick_config.armies_tick_in_seconds);
  const guardsAt = (at: number) =>
    readDeepSites(tiny.store, at, 1).find((site) => String(site.id) === watch!.siteId)!.garrisons.length;
  expect(watch!.dueAt).toBeGreaterThan(tiny.startsAt * 1000);
  expect(guardsAt(watch!.dueAt / 1000)).toBe(0);
  expect(guardsAt(watch!.dueAt / 1000 - tickSeconds)).toBe(1);
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

it("forecasts the same opportunity regardless of the last attacked target", () => {
  const f = fixture([siteGuardTroops(1, 800), 1]);
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
  f.change("ArmyCombat", key, { last_target: f.site.entity_id });
  const due = f.plan().map(({ dueAt }) => dueAt);
  const tickSeconds = Number(rules.tick_config.armies_tick_in_seconds);
  expect(due).toEqual([(Math.floor(f.startsAt / tickSeconds) + 1) * tickSeconds * 1000]);
  expect(f.store.require("ArmyCombat", key).last_target).toBe(f.site.entity_id);
  f.change("ArmyCombat", key, { last_target: 0n });
  expect(f.plan().map(({ dueAt }) => dueAt)).toEqual(due);
});

const ungarrison = (f: ReturnType<typeof fixture>) =>
  f.store.applyFacts(
    [...f.store.inGame("GarrisonSlot", 1)].flatMap((row) => [
      { model: "GarrisonSlot" as const, key: f.store.wireKeyOf("GarrisonSlot", row)!, value: null },
      { model: "Guard" as const, key: f.store.wireKeyOf("Guard", row)!, value: null },
    ]),
  );

function secondRing(f: ReturnType<typeof fixture>, realms: number) {
  const rules = f.store.require("DeepRules", { game_id: 1 });
  f.change("DeepRules", { game_id: 1 }, { rings: [...rules.rings, { radius: 8, realms }] });
  for (const site of [...f.store.inGame("DeepSite", 1)]) {
    const entity_id = site.entity_id + 100n;
    const at = f.store.entityOccupancy(1, site.entity_id)!;
    const structure = f.store.require("Structure", { game_id: 1, entity_id: site.entity_id });
    f.write("DeepSite", { ...site, entity_id, ring: 1 });
    f.write("TileOccupancy", { ...at, entity_id, row: at.row + 3 });
    f.write("Structure", { ...structure, entity_id });
    const guard = f.store.get("Guard", { game_id: 1, structure_id: site.entity_id, slot: 0 });
    if (guard) f.write("Guard", { ...guard, structure_id: entity_id });
  }
}

it("offers an open site with no garrison at once, since taking it needs no fight", () => {
  const f = fixture();
  ungarrison(f);
  expect(f.plan()).toEqual([
    expect.objectContaining({
      kind: HELD.id,
      siteName: HELD.name,
      dueAt: f.startsAt * 1000,
    }),
  ]);
});

it("ignores a closed ring, then plans each open site at its own time and announces the ring when entries open it", () => {
  const f = fixture();
  secondRing(f, 30);
  const guarded = f.plan();
  expect(guarded).toHaveLength(1);
  expect(guarded[0]!.dueAt).toBeGreaterThan(f.startsAt * 1000);
  expect(f.rings()).toEqual([]);
  f.write("DeepEntries", { game_id: 1, day: 0n, count: 30 });
  const open = f.plan();
  expect(open.map(({ kind }) => kind)).toEqual([HELD.id, HELD.id]);
  expect(open.find(({ siteId }) => siteId === guarded[0]!.siteId)?.dueAt).toBe(guarded[0]!.dueAt);
  expect(open.find(({ siteId }) => siteId !== guarded[0]!.siteId)?.dueAt).toBe(f.startsAt * 1000);
  expect(f.rings()).toEqual([expect.objectContaining({ ring: 1, day: 0, sites: nativeRuleConstants.DEEP_RING_SITES })]);
});
