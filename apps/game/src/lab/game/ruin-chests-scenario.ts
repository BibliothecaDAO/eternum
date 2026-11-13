import { frontierPreset } from "../../../../../config/source/frontier/native";
import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import { wire, type LabFact, type LabScenario } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";

const HOME = 7n;

/**
 * The layer switch's ruin chests (/lab/game?scenario=ruin-chests): the owner's army beside today's Surface ruin, Ethereal
 * I and II reached, and today's Ethereal I chest already taken by realm 7: a cleared ruin site in that depth's band
 * of today's map with its receipt naming the home, and today's discovery row saying a ruin was cleared, as the contract
 * writes both. The switch reads World open (the home's own region, held), Ethereal I taken, Ethereal II not known (no
 * army holds it in view) and Ethereal III locked.
 */
export const ruinChestsScenario = (): LabScenario => chestsScenario({ reached: 2n, claimed: [1] });

/**
 * The same realm before any depth research (/lab/game?scenario=ruin-chests-surface), nothing cleared today: the switch
 * stays Realm / World and carries World open and Ethereal I to III locked.
 */
export const ruinChestsSurfaceScenario = (): LabScenario => chestsScenario({ reached: 0n, claimed: [] });

/** Realm 7's day with `reached` depths and today's chests already taken at the `claimed` depths. */
const chestsScenario = ({ reached, claimed }: { reached: bigint; claimed: readonly number[] }): LabScenario => {
  const scenario = ruinFightScenario();
  const { store } = scenario;
  const spacing = store.require("SettlementRules", { game_id: 1 }).spacing;
  const ruin = [...store.inGame("ExpeditionSite", 1)].find((site) => site.category === StructureType.Ruin)!;
  const today = Math.floor(Math.floor(ruin.row / spacing) / 4);
  const homeKey = { game_id: 1, entity_id: HOME };
  const home = store.require("Structure", homeKey);
  const discoveryKey = { game_id: 1, structure_id: HOME, epoch: BigInt(today) };
  const discovery = store.get("ExpeditionDiscovery", discoveryKey);
  const receipt = (depth: number, index: number): LabFact => ({
    model: "ExpeditionSite",
    key: `0x1c${index}`,
    value: wire({
      game_id: 1,
      entity_id: 9_100 + depth,
      category: StructureType.Ruin,
      beast_kind: "None" as const,
      initial_guard_count: 999n * 1_000_000_000n,
      alt: false,
      col: ruin.col,
      row: (today * 4 + depth) * spacing + Math.floor(spacing / 2),
      clear: {
        explorer_id: 201n,
        home_id: HOME,
        reward: { resource_type: ResourcesIds.Lords, amount: 100n * 1_000_000_000n },
      },
    }),
  });
  const chest = frontierPreset.chests;
  store.applyFacts([
    {
      model: "ChestRules",
      key: "0x1cafe",
      value: wire({
        game_id: 1,
        price_ceiling: BigInt(chest.priceCeiling),
        shares: chest.shares,
        claim_window_seconds: chest.claimWindowSeconds,
        pool_bps: chest.poolBps,
        top_n: chest.topN,
      }),
    },
    {
      model: "Structure",
      key: store.wireKeyOf("Structure", homeKey)!,
      value: wire({ ...home, metadata: { ...home.metadata, deepest_depth: Number(reached) } }),
    },
    ...claimed.map(receipt),
    {
      model: "ExpeditionDiscovery",
      key: store.wireKeyOf("ExpeditionDiscovery", discoveryKey) ?? "0x1c9",
      value: wire({
        game_id: 1,
        structure_id: HOME,
        epoch: BigInt(today),
        empty_reveals: discovery?.empty_reveals ?? 0,
        ruin_cleared: claimed.length > 0,
      }),
    },
  ] as never);
  return scenario;
};
