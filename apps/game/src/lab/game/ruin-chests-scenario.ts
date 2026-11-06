import { ResourcesIds, StructureType } from "@bibliothecadao/types";

import { wire, type LabFact, type LabScenario } from "./lab-chain";
import { ruinFightScenario } from "./ruin-fight-scenario";

const HOME = 7n;
/** The depth whose chest realm 7 has already taken today: Ethereal I. */
const CLAIMED_DEPTHS = [1];
/** The deepest layer realm 7 has researched: Ethereal II, so Ethereal III stays locked. */
const RESEARCHED_DEPTH = 2n;

/**
 * The layer switch's ruin chests (/lab/game?scenario=ruin-chests): the owner's army beside today's Surface ruin, Ethereal
 * I and II researched, and today's Ethereal I chest already taken by realm 7, as a cleared ruin site in that depth's band
 * of today's map with its receipt naming the home. The switch reads World open, Ethereal I taken, Ethereal II open and
 * Ethereal III locked.
 */
export const ruinChestsScenario = (): LabScenario => {
  const scenario = ruinFightScenario();
  const { store } = scenario;
  const spacing = store.require("SettlementRules", { game_id: 1 }).spacing;
  const ruin = [...store.inGame("ExpeditionSite", 1)].find((site) => site.category === StructureType.Ruin)!;
  const today = Math.floor(Math.floor(ruin.row / spacing) / 4);
  const facts: LabFact[] = [
    {
      model: "RealmKnowledge",
      key: "0xd",
      value: {
        ...(wire(store.require("RealmKnowledge", { game_id: 1, structure_id: 7 })) as object),
        learned: String(RESEARCHED_DEPTH << 48n),
      },
    },
    ...CLAIMED_DEPTHS.map((depth, index) => ({
      model: "ExpeditionSite",
      key: `0x1c${index}`,
      value: wire({
        game_id: 1,
        entity_id: 9_100 + depth,
        category: StructureType.Ruin,
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
    })),
  ];
  store.applyFacts(facts as never);
  return scenario;
};
