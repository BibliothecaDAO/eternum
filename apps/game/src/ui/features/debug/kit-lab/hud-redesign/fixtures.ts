import { iconUrl } from "@/ui/design-system/icon-meaning";
import {
  createTerrainVerificationRequest,
  TERRAIN_SETTLEMENT_REGROWTH_SITES,
} from "@/three/terrain/verification/terrain-verification-fixtures";
import { BiomeTypeToId, StructureType, TileOccupier } from "@bibliothecadao/types";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
export function makeStructures(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name:
      index === 0
        ? "Hetokamohuti"
        : index === 1
          ? "Ilgzhijajilg"
          : index === 2
            ? "Stolsli"
            : index === 219
              ? "Lastwatch 220"
              : `${["Ashford", "Highmere", "Redwater", "Stonegate", "Westreach"][index % 5]} ${String(index + 1).padStart(3, "0")}`,
    kind:
      index < 3
        ? "Realm"
        : ["Realm", "Village", "Camp", "Hyperstructure", "Mine", "Bank", "BitcoinMine", "Rift", "Ruin", "Stragglers"][
            (index - 3) % 10
          ],
    level: index === 2 ? 0 : index % 4,
    needs: index % 7 === 0,
    guards: index % 7 === 0 ? 0 : 1 + (index % 3),
  }));
}
export type Holding = ReturnType<typeof makeStructures>[number];

export const resources = [
  { name: "Wheat", held: "12.4k", buildings: 3, producing: true, seconds: 480, rate: "+120 / min" },
  { name: "Wood", held: "4.8k", buildings: 2, producing: true, seconds: 720, rate: "+60 / min" },
  { name: "Stone", held: "2.1k", buildings: 2, producing: false, seconds: 0, rate: "Idle" },
  { name: "Coal", held: "960", buildings: 1, producing: true, seconds: 360, rate: "+20 / min" },
  { name: "Copper", held: "840", buildings: 1, producing: true, seconds: 300, rate: "+15 / min" },
  { name: "Knight", held: "120", buildings: 1, producing: false, seconds: 0, rate: "Idle" },
];

export const troopFixtures = ["Knight", "Crossbowman", "Paladin"].flatMap((type, typeIndex) =>
  [1, 2, 3].map((tier) => ({
    resource: tier === 1 ? type : `${type}T${tier}`,
    label: `${type} T${tier}`,
    held: 120 - typeIndex * 20 - (tier - 1) * 10,
    army: `${type} company ${tier}`,
  })),
);

export const actionChoices = [
  { id: "build", word: "Build", image: iconUrl("build") },
  { id: "production", word: "Production", image: iconUrl("production") },
  { id: "military", word: "Military", image: iconUrl("military") },
  { id: "transfer", word: "Transfer", image: iconUrl("transfer") },
  { id: "trade", word: "Trade", image: iconUrl("trade") },
] as const;

export function currentStructure(holding: Holding): StructureWithMetadata {
  const category = StructureType[holding.kind as keyof typeof StructureType] as StructureType;
  return {
    entityId: holding.id,
    category,
    isMine: true,
    isMercenary: false,
    owner: 1n,
    position: { alt: false, x: 12, y: 8 },
    structure: {
      game_id: 1,
      entity_id: BigInt(holding.id),
      owner: 1n,
      resources_packed: 0n,
      base: {
        category,
        level: holding.level,
        created_at: 1,
        troop_max_guard_count: 3,
        troop_max_explorer_count: 3,
        starting_troops_granted: true,
      },
      metadata: {
        realm_id: holding.id,
        order: 0,
        has_wonder: false,
        village_realm: 0n,
        mine_kind: 0,
        deepest_depth: 0,
      },
    },
    displayName: holding.name,
    originalName: holding.name,
    realmLevel: holding.level,
    realmLevelLabel: ["Settlement", "City", "Kingdom", "Empire"][holding.level],
    population: 5,
    populationCapacity: 6,
    guardCount: holding.guards,
    explorerCount: 1,
    buildingTilesOccupied: 5,
    buildingTilesTotal: 6,
    groupColor: null,
    isFavorite: false,
    canUpgrade: category === StructureType.Realm && holding.level < 3,
    buildingCounts: {
      wheat: 3,
      wood: 2,
      coal: 1,
      copper: 1,
      crossbowmanT1: 0,
      knightT1: 1,
      market: 0,
      paladinT1: 0,
      workerHut: 0,
    },
  };
}

export function fixtureCommands(count: number): ReadonlySet<string> {
  return new Set([
    "CreateBuilding",
    "BurnResourceForResourceProduction",
    "CreateExplorer",
    "SendResources",
    ...(count === 220 ? ["CreateTradeOrder"] : []),
  ]);
}

const terrainFixture = createTerrainVerificationRequest("settlement-regrowth");
export const minimapTiles = terrainFixture.cells.map((cell) => {
  const siteIndex = TERRAIN_SETTLEMENT_REGROWTH_SITES.findIndex(
    (site) => site.col === cell.col && site.row === cell.row,
  );
  const armyId = cell.col === 7 && cell.row === 3 ? "501" : cell.col === 12 && cell.row === 2 ? "999" : null;
  return {
    col: cell.col,
    row: cell.row,
    biome: cell.biome ? BiomeTypeToId[cell.biome] : undefined,
    ...(siteIndex >= 0
      ? {
          occupier_id: String(siteIndex + 1),
          occupier_type: TileOccupier.RealmRegularLevel1 + (siteIndex === 2 ? 0 : siteIndex),
          occupier_is_structure: true,
        }
      : armyId
        ? { occupier_id: armyId, occupier_type: TileOccupier.ExplorerKnightT1, occupier_is_structure: false }
        : {}),
  };
});
