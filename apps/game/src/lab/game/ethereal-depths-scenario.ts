import { readExpeditionRules, seasonDay } from "@bibliothecadao/eternum";
import { BiomeType, getHexesWithinRadius, StructureType, TileOccupier } from "@bibliothecadao/types";
import looks from "@/three/terrain/ethereal-depths.json";
import { foundSpireFacts, SPIRE_ARMY, SPIRE_ARMY_TILE_KEY, SPIRE_DAY_NOW } from "@/ui/features/frontier/spire-fixture";
import { spireScenario, revealedTile } from "./spire-scenario";
import { wire, type LabFact, type LabScenario } from "./lab-chain";

/**
 * Frontier's real Spire flow into one depth (/lab/game?scenario=ethereal-depths-<depth>): the army stands beside the
 * spire its realm found today on the layer above, the land below it explored, and something that really stands there
 * beside the arrival for scale (scaleReference). A spire leads one layer down, so each depth starts one layer up.
 */
const etherealDepthScenario = (depth: 1 | 2 | 3) => (): LabScenario => {
  const scenario = spireScenario();
  const { store } = scenario;
  const rules = readExpeditionRules(store, 1)!;
  const day = seasonDay(rules, SPIRE_DAY_NOW)!;
  const above = depth - 1;
  const down = (hex: { col: number; row: number }, layers: number) => ({
    col: hex.col,
    row: hex.row + layers * rules.spacing,
  });
  const surfaceSpire = store.require("ExpeditionSpire", {
    game_id: 1,
    structure_id: 7,
    epoch: day,
    depth: 0,
  }).location!;
  const spire = down({ col: surfaceSpire.x, row: surfaceSpire.y }, above);
  const army = store.entityOccupancy(1, SPIRE_ARMY)!;
  const arrival = down(spire, 1);
  const facts: LabFact[] = [
    ...(above > 0 ? foundSpireFacts(spire, { day, depth: above }) : []),
    // Below the surface the army stands beside that layer's spire: its tile row moves there, as a move writes it.
    ...(above > 0
      ? [
          { model: "TileOccupancy", key: SPIRE_ARMY_TILE_KEY, value: null },
          { model: "TileOccupancy", key: `0x904${depth}`, value: wire({ ...army, ...down(army, above) }) },
        ]
      : []),
    ...[arrival, ...getHexesWithinRadius(arrival.col, arrival.row, 7)].map((hex, index) =>
      revealedTile(`0xe${depth}${index.toString(16).padStart(3, "0")}`, hex, BiomeType.Grassland),
    ),
    ...scaleReference(store, { col: arrival.col - 1, row: arrival.row - 1 }, { day, depth }),
  ];
  store.applyFacts(facts as never);
  return scenario;
};

/** The entity of the Deep's hyperstructure that stands for scale beside the arrival there (steps.mjs reads its plate). */
const DEEP_SCALE_HYPERSTRUCTURE = 903;

/**
 * What stands beside the arrival for scale, as a player meets it there: a spire the realm found on that Ethereal layer,
 * or in the Deep, which has no spire, an Aspect's hyperstructure, which stands on its fixed tile of the Deep
 * (docs/plans/frontier-season-1.md, the hyperstructure).
 */
const scaleReference = (
  store: LabScenario["store"],
  tile: { col: number; row: number },
  { day, depth }: { day: number; depth: 1 | 2 | 3 },
): LabFact[] => {
  if (depth < 3) return foundSpireFacts(tile, { day, depth });
  const realm = store.require("Structure", { game_id: 1, entity_id: 7 });
  return [
    {
      model: "Structure",
      key: "0xef3",
      value: wire({
        ...realm,
        entity_id: DEEP_SCALE_HYPERSTRUCTURE,
        owner: 0n,
        base: { ...realm.base, category: StructureType.Hyperstructure, level: 0 },
        metadata: { ...realm.metadata, realm_id: 0, order: 0, has_wonder: false },
      }),
    },
    // The game's hyperstructure rules, which a game with hyperstructures carries; none of its resources is asked here.
    { model: "HyperstructureRules", key: "0xef6", value: { game_id: 1, initialize_shards: "0", resources: [] } },
    {
      model: "Hyperstructure",
      key: "0xef4",
      value: { game_id: 1, entity_id: DEEP_SCALE_HYPERSTRUCTURE, stage: "Construction", access: "Public", seed: "0x1" },
    },
    {
      model: "TileOccupancy",
      key: "0xef5",
      value: {
        game_id: 1,
        alt: false,
        ...tile,
        entity_id: DEEP_SCALE_HYPERSTRUCTURE,
        category: TileOccupier.Hyperstructure,
        is_structure: true,
      },
    },
  ];
};

/** One lab game per depth the terrain has a look for. */
export const ETHEREAL_DEPTH_SCENARIOS = Object.fromEntries(
  Object.keys(looks).map((depth) => [`ethereal-depths-${depth}`, etherealDepthScenario(Number(depth) as 1 | 2 | 3)]),
);
