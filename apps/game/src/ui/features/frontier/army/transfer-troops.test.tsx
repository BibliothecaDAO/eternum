import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

// The game applies what is sent: the send's outcome stands in for the shard's answer.
vi.mock("@/sync/action-outcome", async (original) => ({
  ...(await original<typeof import("@/sync/action-outcome")>()),
  untilApplied: async (sent: Promise<unknown>) => {
    await sent;
    return "0x1";
  },
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import { getDirectionBetweenAdjacentHexes, getNeighborHexes, TileOccupier } from "@bibliothecadao/types";

import { campBeside } from "../sites/site-fixture";
import { TransferTroopsSheet, useSelectedTransfer } from "./transfer-troops";

const PRECISION = 1_000_000_000n;
/** The fixture's army (explorer 201, 1,498 knights) stands at (41, 12); its realm's second army stands beside it. */
const PICKED = { col: 41, row: 12 };
const TAPPED = getNeighborHexes(PICKED.col, PICKED.row)[0]!;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useAccountStore.setState({ account: { address: "0x111" } as never });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useUIStore.getState().selectOnMap(null);
  setBlockTimestampSource(null);
});

/** The realm's second army, 300 knights of the first's kind (or of another tier), on the tile beside it. */
const twoArmies = ({ tier = "T1" }: { tier?: string } = {}) => {
  const { store } = campBeside();
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x92",
      value: wire({ ...first, explorer_id: 202, troops: { ...first.troops, tier, count: 300n * PRECISION } }),
    },
    {
      model: "TileOccupancy",
      key: "0x93",
      value: {
        game_id: 1,
        alt: false,
        col: TAPPED.col,
        row: TAPPED.row,
        entity_id: 202,
        category: TileOccupier.ExplorerKnightT1,
        is_structure: false,
      },
    },
  ] as never);
  return store;
};

/** The selection's transfer card, as the HUD draws it for the realm. */
const Card = ({ realm, onClose }: { realm: never; onClose: () => void }) => {
  const pair = useSelectedTransfer(realm);
  return pair && <TransferTroopsSheet realm={realm} pair={pair} onClose={onClose} />;
};

/** The player picked army 201 and tapped the army beside it: the map acts on that tile with 201 (its Help order). */
const render = (store: ReturnType<typeof twoArmies>) => {
  const swap = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const close = vi.fn();
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: TAPPED });
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { explorer_explorer_swap: swap } } as never}
        account={{ address: "0x111" } as never}
      >
        <Card realm={store.require("Structure", { game_id: 1, entity_id: 7 }) as never} onClose={close} />
      </GameProvider>,
    ),
  );
  return { swap, close };
};

const button = (text: string | RegExp) =>
  [...host.querySelectorAll<HTMLButtonElement>("button")].find((each) =>
    typeof text === "string" ? each.textContent === text : text.test(each.textContent ?? ""),
  );
/** The two armies as the card shows them: name, then what each holds after. */
const sides = () =>
  [...host.querySelectorAll(".text-hud-strong")].map((name) => [
    name.textContent,
    name.parentElement!.querySelector(".text-hud-title")!.textContent,
  ]);

it("opens as a merge into the army tapped, and moves the split the player picks, either way", async () => {
  const store = twoArmies();
  const { swap, close } = render(store);
  const [[picked], [tapped]] = sides() as [string, string][];
  // Everything into the army tapped, up to the 1,500 a Settlement's army holds: 298 stay.
  expect(sides()).toEqual([
    [picked, "298"],
    [tapped, "1,500"],
  ]);
  expect(button(`Move 1,200 to ${tapped}`)).toBeDefined();
  expect(host.textContent).toContain("An army holds at most 1,500.");

  // Even: 899 each, so 599 leave the picked army.
  act(() => button("Even")!.click());
  expect(sides()).toEqual([
    [picked, "899"],
    [tapped, "899"],
  ]);
  await act(async () => button(`Move 599 to ${tapped}`)!.click());
  expect(swap).toHaveBeenCalledWith(
    expect.objectContaining({
      from_explorer_id: 201,
      to_explorer_id: 202,
      to_explorer_direction: getDirectionBetweenAdjacentHexes(PICKED, TAPPED),
      count: Number(599n * PRECISION),
    }),
  );
  expect(close).toHaveBeenCalledOnce();
});

it("sends the other way when the split gives the picked army more, and empties an army that gives all", async () => {
  const store = twoArmies();
  // The picked army a scout of 200: everything the tapped army holds fits in it.
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: JSON.parse(
        JSON.stringify({ ...first, troops: { ...first.troops, count: 200n * PRECISION } }, (_, field) =>
          typeof field === "bigint" ? field.toString() : field,
        ),
      ),
    },
  ] as never);
  const { swap } = render(store);
  const [[picked], [tapped]] = sides() as [string, string][];
  act(() => button(`All to ${picked}`)!.click());
  expect(host.textContent).toContain(`${tapped} is left with none and leaves the map.`);
  await act(async () => button(`Move 300 to ${picked}`)!.click());
  expect(swap).toHaveBeenCalledWith(
    expect.objectContaining({
      from_explorer_id: 202,
      to_explorer_id: 201,
      to_explorer_direction: getDirectionBetweenAdjacentHexes(TAPPED, PICKED),
      count: Number(300n * PRECISION),
    }),
  );
});

it("offers nothing to send between armies of different tiers, and says why", () => {
  const { swap } = render(twoArmies({ tier: "T2" }));
  expect(host.textContent).toContain("only armies of the same troops and tier join");
  expect(button(/^Move /)).toBeUndefined();
  expect(swap).not.toHaveBeenCalled();
});

it("is no card for an army acting on a tile with none of the realm's armies on it", () => {
  const store = twoArmies();
  useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: { col: 0, row: 0 } });
  act(() =>
    root.render(
      <GameProvider value={{ store, systemCalls: {} } as never} account={{ address: "0x111" } as never}>
        <Card realm={store.require("Structure", { game_id: 1, entity_id: 7 }) as never} onClose={() => undefined} />
      </GameProvider>,
    ),
  );
  expect(host.querySelector("[data-kit-sheet]")).toBeNull();
});
