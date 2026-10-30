// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { GameProvider } from "@/hooks/context/game-context";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { type GameClientSetup, nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

import { realmBoard } from "../build/build-fixture";
import { FrontierResearch } from "./frontier-research";
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
  value: {
    common_xp: 100,
    game_id: 1,
    reveal_xp: 2,
    reveal_xp_per_depth: 1,
    fixed_xp: 200,
    uncommon_xp: 250,
    rare_xp: 500,
    epic_xp: 1000,
    legendary_xp: 2000,
  },
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

it("says the tree is on its way while a fact it reads is missing, and draws the tree once it arrives", () => {
  const { store, realm } = realmBoard();
  store.applyFacts([XP_RULES, ...ALL_PRICES.filter(({ value }) => value.row !== research.ROW_SHRINE)] as never);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <FrontierResearch realm={realm} onClose={() => undefined} />
      </GameProvider>,
    ),
  );
  // The page says so in its own frame, as it stands once the tree is drawn.
  const page = host.querySelector('section[data-kit-frame][aria-label="Research"]');
  expect(page?.querySelector('[role="status"]')?.textContent).toBe("The research tree is on its way");

  act(() => store.applyFacts(ALL_PRICES.filter(({ value }) => value.row === research.ROW_SHRINE) as never));
  expect(host.textContent).not.toContain("on its way");
  expect(host.textContent).toContain("Shrine");
});

it("opens on the tree alone, to browse, and brings a node's choice only when its tile is tapped", () => {
  const { store, realm } = realmBoard();
  store.applyFacts([XP_RULES, ...ALL_PRICES] as never);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <FrontierResearch realm={realm} onClose={() => undefined} />
      </GameProvider>,
    ),
  );
  // The owner, 27 October: "it shouldnt open up the one I can research I just wanna browse".
  expect(host.querySelector("[data-lab='node-choice']")).toBeNull();
  // Nor does the panel's head repeat the Essence and labor the top bar shows.
  expect(host.querySelector(".ui-chip")).toBeNull();

  act(() => host.querySelector<HTMLButtonElement>("[data-node='shrine']")!.click());
  expect(host.querySelector("[data-lab='node-choice']")!.textContent).toContain("Shrine");
});
