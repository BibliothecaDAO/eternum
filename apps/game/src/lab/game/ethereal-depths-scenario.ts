import { readExpeditionRules, seasonDay } from "@bibliothecadao/eternum";
import { BiomeType, getHexesWithinRadius } from "@bibliothecadao/types";
import looks from "@/three/terrain/ethereal-depths.json";
import { foundSpireFacts, SPIRE_ARMY, SPIRE_ARMY_TILE_KEY, SPIRE_DAY_NOW } from "@/ui/features/frontier/spire-fixture";
import { spireScenario, revealedTile } from "./spire-scenario";
import { wire, type LabFact, type LabScenario } from "./lab-chain";

/**
 * Frontier's real Spire flow into one depth (/lab/game?scenario=ethereal-depths-<depth>): the army stands beside the
 * spire its realm found today on the layer above, the land below it explored, and a found spire beside the arrival
 * keeps the same scale reference in every depth's stills. A spire leads one layer down, so each depth starts one layer
 * up.
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
    ...foundSpireFacts({ col: arrival.col - 1, row: arrival.row - 1 }, { day, depth }).filter(
      ({ model }) => depth < 3 || model === "TileOccupancy",
    ),
  ];
  store.applyFacts(facts as never);
  return scenario;
};

/** One lab game per depth the terrain has a look for. */
export const ETHEREAL_DEPTH_SCENARIOS = Object.fromEntries(
  Object.keys(looks).map((depth) => [`ethereal-depths-${depth}`, etherealDepthScenario(Number(depth) as 1 | 2 | 3)]),
);
