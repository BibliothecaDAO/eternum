// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { GameProvider } from "@/hooks/context/game-context";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { type GameClientSetup, nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import { realmBoard } from "../build/build-fixture";
import { useResearchTree } from "./research-facts";

let host: HTMLDivElement;
let root: Root;
let tree: ReturnType<typeof useResearchTree>;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  setBlockTimestampSource(null);
});

const Probe = ({ realm }: { realm: Parameters<typeof useResearchTree>[0] }) => {
  tree = useResearchTree(realm);
  return null;
};

const PRECISION = BigInt(RESOURCE_PRECISION);
const XP_RULES = {
  model: "ArmyProgressionRules",
  key: "0xa1",
  value: { game_id: 1, reveal_xp: 2, fixed_xp: 200, uncommon_xp: 100, rare_xp: 200, epic_xp: 400, legendary_xp: 800 },
};
/** Every row's price at every tier, the Shrine's at 2,000 Essence and 0 labor; each building tier 4,000 and 3,000. */
const price = (row: number, tier: number) => ({
  model: "ResearchPrice",
  key: `0x${row}${tier}`,
  value: {
    game_id: 1,
    row,
    tier,
    essence: String((row === research.ROW_SHRINE ? 2_000n : 4_000n) * PRECISION),
    labor: String((row === research.ROW_SHRINE ? 0n : 3_000n) * PRECISION),
  },
});
const ALL_PRICES = Array.from({ length: research.ROW_COUNT }, (_, row) =>
  [1, 2, 3, 4].map((tier) => price(row, tier)),
).flat();

it("keeps the tree unknown while a price it reads is missing, then reads each node's exact price once it arrives", () => {
  const { store, realm } = realmBoard();
  store.applyFacts([XP_RULES] as never);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Probe realm={realm} />
      </GameProvider>,
    ),
  );

  // Every price but the Shrine's: no tree, never one priced at nothing.
  act(() => store.applyFacts(ALL_PRICES.filter(({ value }) => value.row !== research.ROW_SHRINE) as never));
  expect(tree).toBeUndefined();

  act(() => store.applyFacts([price(research.ROW_SHRINE, 1)] as never));
  const shrine = tree!.nodes.find(({ key }) => key === "shrine")!;
  expect(shrine.price).toEqual({ essence: 2_000, labor: 0 });
  // The realm holds no Essence: the Shrine waits on it, with what it holds against what it needs.
  expect(tree!.essence).toBe(0);
  expect(shrine.state).toBe("short");
  expect(shrine.needs).toContainEqual(expect.objectContaining({ kind: "essence", met: false, have: 0, need: 2_000 }));
});
