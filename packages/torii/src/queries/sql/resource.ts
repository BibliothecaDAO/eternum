import { ResourcesIds } from "@bibliothecadao/types";

/**
 * Maps `s1_eternum-Resource` balance column names to their ResourcesIds enum values
 * and display names. Only includes economic/game resources (no troops or relics).
 */
export const RESOURCE_BALANCE_COLUMNS: ReadonlyArray<{
  column: string;
  resourceId: ResourcesIds;
  name: string;
}> = [
  { column: "STONE_BALANCE", resourceId: ResourcesIds.Stone, name: "Stone" },
  { column: "COAL_BALANCE", resourceId: ResourcesIds.Coal, name: "Coal" },
  { column: "WOOD_BALANCE", resourceId: ResourcesIds.Wood, name: "Wood" },
  { column: "COPPER_BALANCE", resourceId: ResourcesIds.Copper, name: "Copper" },
  { column: "IRONWOOD_BALANCE", resourceId: ResourcesIds.Ironwood, name: "Ironwood" },
  { column: "OBSIDIAN_BALANCE", resourceId: ResourcesIds.Obsidian, name: "Obsidian" },
  { column: "GOLD_BALANCE", resourceId: ResourcesIds.Gold, name: "Gold" },
  { column: "SILVER_BALANCE", resourceId: ResourcesIds.Silver, name: "Silver" },
  { column: "MITHRAL_BALANCE", resourceId: ResourcesIds.Mithral, name: "Mithral" },
  { column: "ALCHEMICAL_SILVER_BALANCE", resourceId: ResourcesIds.AlchemicalSilver, name: "Alchemical Silver" },
  { column: "COLD_IRON_BALANCE", resourceId: ResourcesIds.ColdIron, name: "Cold Iron" },
  { column: "DEEP_CRYSTAL_BALANCE", resourceId: ResourcesIds.DeepCrystal, name: "Deep Crystal" },
  { column: "RUBY_BALANCE", resourceId: ResourcesIds.Ruby, name: "Ruby" },
  { column: "DIAMONDS_BALANCE", resourceId: ResourcesIds.Diamonds, name: "Diamonds" },
  { column: "HARTWOOD_BALANCE", resourceId: ResourcesIds.Hartwood, name: "Hartwood" },
  { column: "IGNIUM_BALANCE", resourceId: ResourcesIds.Ignium, name: "Ignium" },
  { column: "TWILIGHT_QUARTZ_BALANCE", resourceId: ResourcesIds.TwilightQuartz, name: "Twilight Quartz" },
  { column: "TRUE_ICE_BALANCE", resourceId: ResourcesIds.TrueIce, name: "True Ice" },
  { column: "ADAMANTINE_BALANCE", resourceId: ResourcesIds.Adamantine, name: "Adamantine" },
  { column: "SAPPHIRE_BALANCE", resourceId: ResourcesIds.Sapphire, name: "Sapphire" },
  { column: "ETHEREAL_SILICA_BALANCE", resourceId: ResourcesIds.EtherealSilica, name: "Ethereal Silica" },
  { column: "DRAGONHIDE_BALANCE", resourceId: ResourcesIds.Dragonhide, name: "Dragonhide" },
  { column: "LABOR_BALANCE", resourceId: ResourcesIds.Labor, name: "Labor" },
  { column: "EARTHEN_SHARD_BALANCE", resourceId: ResourcesIds.AncientFragment, name: "Ancient Fragment" },
  { column: "DONKEY_BALANCE", resourceId: ResourcesIds.Donkey, name: "Donkey" },
  { column: "WHEAT_BALANCE", resourceId: ResourcesIds.Wheat, name: "Wheat" },
  { column: "FISH_BALANCE", resourceId: ResourcesIds.Fish, name: "Fish" },
  { column: "LORDS_BALANCE", resourceId: ResourcesIds.Lords, name: "Lords" },
  { column: "ESSENCE_BALANCE", resourceId: ResourcesIds.Essence, name: "Essence" },
];

const BALANCE_COLS = RESOURCE_BALANCE_COLUMNS.map((c) => c.column).join(", ");

export const RESOURCE_QUERIES = {
  /**
   * Fetch resource balances for a set of entity IDs.
   * Selects only *_BALANCE columns (29 cols) instead of the full Resource table (218 cols).
   */
  RESOURCE_BALANCES: `
    SELECT entity_id, ${BALANCE_COLS}
    FROM \`s1_eternum-Resource\`
    WHERE entity_id IN ({entityIds});
  `,
} as const;
