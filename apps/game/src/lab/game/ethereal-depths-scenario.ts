import { readExpeditionRules } from "@bibliothecadao/eternum";
import { BiomeType, getHexesWithinRadius, TileOccupier } from "@bibliothecadao/types";
import looks from "@/three/terrain/ethereal-depths.json";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { spireScenario, revealedTile } from "./spire-scenario";
import { wire, type LabFact, type LabScenario } from "./lab-chain";

/** Frontier's real Spire flow with all depths researched and previously explored land at each arrival. */
export function etherealDepthsScenario(): LabScenario {
  const scenario = spireScenario();
  const { store } = scenario;
  const rules = readExpeditionRules(store, 1)!;
  const army = [...store.entries("TileOccupancy")].find(([, tile]) => tile.entity_id === BigInt(SPIRE_ARMY))![1];
  const facts: LabFact[] = [
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: {
        ...(wire(store.require("RealmKnowledge", { game_id: 1, structure_id: 7 })) as object),
        learned: String(3n << 48n),
      },
    },
  ];
  for (const depth of Object.keys(looks).map(Number)) {
    const arrival = { col: army.col, row: army.row + depth * rules.spacing };
    const cells = [arrival, ...getHexesWithinRadius(arrival.col, arrival.row, 7)];
    cells.forEach((hex, index) =>
      facts.push(revealedTile(`0xe${depth}${index.toString(16).padStart(3, "0")}`, hex, BiomeType.Grassland)),
    );
    // A fixture Spire beside each arrival keeps the same scale reference in all six game stills.
    facts.push({
      model: "TileOccupancy",
      key: `0xef${depth}`,
      value: {
        game_id: 1,
        alt: false,
        col: arrival.col - 1,
        row: arrival.row - 1,
        entity_id: 900 + depth,
        category: TileOccupier.Spire,
        is_structure: false,
      },
    });
  }
  store.applyFacts(facts as never);
  return scenario;
}
