import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { siteReward } from "@bibliothecadao/eternum";
import { BiomeType, getNeighborHexes, StructureType } from "@bibliothecadao/types";
import { reinforceScenario } from "./reinforce-scenario";
import { revealedTile } from "./spire-scenario";
import { wire, type LabScenario } from "./lab-chain";

export const SUPPLY_POST = 711;

/** A cleared camp away from home, with an adjacent army and the normal reinforcement costs. */
export function supplyPostScenario(): LabScenario {
  const game = reinforceScenario();
  const { store } = game;
  const occupancy = store.entityOccupancy(1, SPIRE_ARMY)!;
  const positionKey = store.wireKeyOf("TileOccupancy", {
    game_id: 1,
    alt: occupancy.alt,
    col: occupancy.col,
    row: occupancy.row,
  })!;
  const position = { ...occupancy, col: occupancy.col + 5 };
  const camp = getNeighborHexes(position.col, position.row)[0]!;
  const site = {
    game_id: 1,
    entity_id: BigInt(SUPPLY_POST),
    category: StructureType.Camp,
    initial_guard_count: 1600_000_000_000n,
    alt: false,
    col: camp.col,
    row: camp.row,
    clear: null,
  };
  const reward = siteReward(store, site)!;
  store.applyFacts([
    { model: "TileOccupancy", key: positionKey, value: null },
    { model: "TileOccupancy", key: "0x1ac02", value: wire(position) },
    ...[position, ...getNeighborHexes(position.col, position.row)].map((hex, index) =>
      revealedTile(`0x1ad${index}`, hex, BiomeType.Grassland),
    ),
    {
      model: "ExpeditionSite",
      key: "0x1ab96",
      value: wire({
        ...site,
        clear: {
          home_id: 7n,
          explorer_id: BigInt(SPIRE_ARMY),
          reward: { resource_type: reward.resourceType, amount: reward.amount },
        },
      }),
    },
  ] as never);
  return { ...game, opensOn: position };
}
