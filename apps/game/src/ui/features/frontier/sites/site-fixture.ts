import { BiomeType } from "@bibliothecadao/types";
import { nativeRuleConstants } from "../../../../../../../contracts/l3/world-native/schema/client.gen";
import rowFixture from "../../../../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import preset from "../../../../../../../contracts/l3/world-native/tests/fixtures/current-presets/preset-3.json";
import { frontierDay } from "../muster/muster-fixture";
import type { SiteAttack } from "./site-card-plan";

const PRECISION = 1_000_000_000n;
export const SITE = 710;
export const SITE_TILE = { col: 40, row: 12, alt: false };
const set = (key: string, model: string, value: Record<string, unknown>) => ({ model, key, value });
const troops = (count: bigint, stamina: bigint) => ({
  ...rowFixture.expected.value.troops,
  count: String(count * PRECISION),
  stamina: { Inline: { amount: String(stamina), updated_tick: "3" } },
});

/**
 * The muster's Frontier day with a camp guarded by 1,100 T1 knights on row 12 and the realm's 1,498-knight army beside
 * it, in a game without combat dice as Frontier plays.
 */
export const campBeside = (kind: "Camp" | "Rift" | "FallenRealm" = "Camp", guardKnown = true) => {
  const { store } = frontierDay();
  const noDice =
    preset.rules.mode_rules & ~(nativeRuleConstants.COMBAT_DICE | nativeRuleConstants.COMBAT_DICE_ETHEREAL);
  store.applyFacts([
    set("0x100", "SliceRules", { ...preset.rules, game_id: 1, epoch_seconds: 100, mode_rules: noDice }),
    set("0x71", "Structure", {
      ...store.require("Structure", { game_id: 1, entity_id: 7 }),
      entity_id: SITE,
      owner: "0x0",
      base: {
        category: 7,
        level: 0,
        created_at: "0x1",
        troop_max_guard_count: 1,
        troop_max_explorer_count: 0,
        starting_troops_granted: true,
      },
    }),
    set("0x72", "ExpeditionSite", {
      game_id: 1,
      entity_id: SITE,
      kind,
      initial_guard_count: String(1_100n * PRECISION),
      cleared: false,
    }),
    ...(guardKnown
      ? [
          set("0x73", "Guard", {
            game_id: 1,
            structure_id: SITE,
            slot: 0,
            troops: troops(1_100n, 0n),
            destroyed_tick: 0,
          }),
        ]
      : []),
    set("0x74", "ExplorerTroops", { game_id: 1, explorer_id: 201, owner: 7, troops: troops(1_498n, 100n) }),
  ] as never);
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const attack = (armyTile: SiteAttack["armyTile"]): SiteAttack => ({
    army,
    armyTile,
    biome: BiomeType.Grassland,
    timestamp: 350,
    armiesTick: 3,
  });
  return {
    store,
    site: store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
    structure: store.require("Structure", { game_id: 1, entity_id: SITE }),
    attack,
  };
};
