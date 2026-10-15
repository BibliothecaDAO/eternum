import { StructureType } from "@bibliothecadao/types";
import type { StructureWithMetadata } from "@/ui/features/world/containers/top-header/structure-picker/chip";
export const viewNames = [
  ["Realm", "World map"],
  ["Settlement", "World"],
  ["Build view", "Explore view"],
] as const;

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
    kind: index % 5 === 3 ? "Village" : index % 5 === 4 ? "Camp" : "Realm",
    level: 1 + (index % 4),
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

export const actionChoices = [
  { id: "build", word: "Build", image: "/image-icons/construction.png" },
  { id: "production", word: "Production", image: "/image-icons/production.png" },
  { id: "military", word: "Military", image: "/image-icons/military.png" },
  { id: "transfer", word: "Transfer", image: "/image-icons/transfer.png" },
  { id: "trade", word: "Trade", image: "/image-icons/trade.png" },
] as const;

export function currentStructure(holding: Holding): StructureWithMetadata {
  const category =
    holding.kind === "Realm"
      ? StructureType.Realm
      : holding.kind === "Camp"
        ? StructureType.Camp
        : StructureType.Village;
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
    realmLevelLabel: "Settlement",
    population: 5,
    populationCapacity: 6,
    guardCount: holding.guards,
    explorerCount: 1,
    buildingTilesOccupied: 5,
    buildingTilesTotal: 6,
    groupColor: null,
    isFavorite: false,
    canUpgrade: true,
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
