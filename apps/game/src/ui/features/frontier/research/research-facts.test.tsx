// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it } from "vitest";

import { GameProvider } from "@/hooks/context/game-context";
import { setBlockTimestampSource, RESEARCH_ROWS } from "@bibliothecadao/eternum";
import { type GameClientSetup, nativeResearchConstants as research } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";

import { realmBoard } from "../build/build-fixture";
import { FrontierResearch } from "./frontier-research";
import { useResearchTree } from "./research-facts";
import { RESEARCH_TREE } from "@/ui/design-system/kit/words";

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
const price = (row: number, tier: number) => ({
  model: "ResearchPrice",
  key: `0x${row}${tier}`,
  value: {
    game_id: 1,
    row,
    tier,
    essence: String((row === research.ROW_LORE ? 2_000n : 4_000n) * PRECISION),
    labor: String((row === research.ROW_LORE ? 0n : 3_000n) * PRECISION),
  },
});
const ALL_PRICES = RESEARCH_ROWS.map((row) => [1, 2, 3, 4].map((tier) => price(row, tier))).flat();

it("keeps the tree unknown while a price it reads is missing, then reads each node's exact price once it arrives", () => {
  const { store, realm } = realmBoard();
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Probe realm={realm} />
      </GameProvider>,
    ),
  );

  act(() => store.applyFacts(ALL_PRICES.filter(({ value }) => value.row !== research.ROW_LORE) as never));
  expect(tree).toBeUndefined();

  act(() => store.applyFacts(ALL_PRICES.filter(({ value }) => value.row === research.ROW_LORE) as never));
  const well = tree!.nodes.find(({ key }) => key === "well")!;
  expect(well.price).toEqual({ essence: 2_000, labor: 0 });
  expect(well.state).toBe("short");
  expect(well.needs).toContainEqual(expect.objectContaining({ kind: "essence", met: false, have: 0, need: 2_000 }));
});

it("says the tree is on its way while a fact it reads is missing, and draws the tree once it arrives", () => {
  const { store, realm } = realmBoard();
  store.applyFacts([...ALL_PRICES.filter(({ value }) => value.row !== research.ROW_LORE)] as never);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <FrontierResearch realm={realm} onClose={() => undefined} />
      </GameProvider>,
    ),
  );
  // The page says so in its own frame, as it stands once the tree is drawn.
  const page = host.querySelector('section[data-kit-frame][aria-label="Research"]');
  expect(page?.querySelector('[role="status"]')?.textContent).toBe(RESEARCH_TREE.onItsWay);

  act(() => store.applyFacts(ALL_PRICES.filter(({ value }) => value.row === research.ROW_LORE) as never));
  expect(host.textContent).not.toContain("Loading research");
  expect(host.textContent).toContain("Shrine");
});

it("opens on the tree alone, to browse, and brings a node's choice only when its tile is tapped", () => {
  const { store, realm } = realmBoard();
  store.applyFacts([...ALL_PRICES] as never);
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

  act(() => host.querySelector<HTMLButtonElement>("[data-node='shrine'] button")!.click());
  expect(host.querySelector("[data-lab='node-choice']")!.textContent).toContain("Shrine");
});

it("reads the Conscription Camp's troops an hour from the Barracks' own rule in the game's facts", () => {
  const { store, realm } = realmBoard();
  const knight = store.require("ResourceRule", { game_id: 1, resource_type: ResourcesIds.Knight });
  store.applyFacts([
    ...ALL_PRICES,
    {
      model: "ResourceRule",
      key: `0x5${ResourcesIds.Knight}`,
      value: {
        game_id: 1,
        resource_type: ResourcesIds.Knight,
        unit_weight: String(knight.unit_weight),
        realm_rate: String((180n * PRECISION) / 3600n),
        village_rate: String(knight.village_rate),
      },
    },
  ] as never);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Probe realm={realm} />
      </GameProvider>,
    ),
  );
  const camp = tree!.nodes.find(({ row }) => row === research.ROW_CONSCRIPTION)!;
  expect(camp.figures).toEqual([
    expect.objectContaining({ name: RESEARCH_TREE.troopsAnHour, line: "At each Barracks", now: "180" }),
  ]);
});
