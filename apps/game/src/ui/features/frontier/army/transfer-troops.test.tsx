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

import { transferArmies } from "./transfer-fixture";
import { toast } from "@/ui/features/event-feed/notify";
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
  vi.restoreAllMocks();
});

/** The realm's second army, 300 knights of the first's kind (or of another tier), on the tile beside it. */
const twoArmies = ({ tier = "T1" }: { tier?: string } = {}) => {
  const store = transferArmies(0, 100);
  const first = store.require("ExplorerTroops", { game_id: 1, explorer_id: 201 });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  store.applyFacts([
    {
      model: "ExplorerTroops",
      key: "0x74",
      value: wire({ ...first, troops: { ...first.troops, count: 1498n * PRECISION } }),
    },
    {
      model: "ExplorerTroops",
      key: "0x92",
      value: wire({
        ...first,
        explorer_id: 202,
        troops: { ...first.troops, stamina: { Slot: 1 }, tier, count: 300n * PRECISION },
      }),
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

/**
 * The player picked army 201 and tapped the army beside it: the map acts on that tile with 201 (its Help order). Or,
 * picking the other way, army 202 acting on 201's tile.
 */
const render = (store: ReturnType<typeof twoArmies>, { picked = 201 }: { picked?: 201 | 202 } = {}) => {
  const swap = vi.fn().mockResolvedValue({ transaction_hash: "0x1" });
  const close = vi.fn();
  useUIStore.getState().selectOnMap({ kind: "army", entityId: picked, tile: picked === 201 ? TAPPED : PICKED });
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
const slider = () => host.querySelector<HTMLInputElement>('input[type="range"]')!;
/** The amount box: how many the picked army sends, as the player types it. */
const typed = () => host.querySelector<HTMLInputElement>('input[aria-label^="Troops "]')!;
/** The slider dragged to `sent`, as a player drags it. */
const slide = (sent: number) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider(), String(sent));
  act(() => slider().dispatchEvent(new Event("input", { bubbles: true })));
};
/** The amount the control holds, read from both its box and its slider, which must agree. */
const amount = () => {
  expect(slider().value).toBe(typed().value.replaceAll(",", ""));
  return typed().value;
};
/** The XP a merge takes off the map with the army it empties, struck out on that army's card; null when none. */
const struckXp = () => host.querySelector("s")?.textContent ?? null;
/** The two armies as the card shows them: name, then what each holds after. */
const sides = () =>
  [...host.querySelectorAll(".text-hud-strong")].map((name) => [
    name.textContent,
    name.parentElement!.querySelector(".text-hud-title")!.textContent,
  ]);

it("opens at all the tapped army can take, and sends the amount the player slides", async () => {
  const store = twoArmies();
  const { swap, close } = render(store);
  const [[picked], [tapped]] = sides() as [string, string][];
  // Everything into the army tapped, up to the 1,500 a Settlement's army holds: 298 stay.
  expect(sides()).toEqual([
    [picked, "298"],
    [tapped, "1,500"],
  ]);
  expect(amount()).toBe("1,200");
  expect(button(`Move 1,200 to ${tapped}`)).toBeDefined();
  expect(host.textContent).toContain("An army holds at most 1,500.");

  // 599 leave the picked army: 899 each.
  slide(599);
  expect(amount()).toBe("599");
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

it("sends the way the map chose: picking the other army sends from it, and all empties it", async () => {
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
  // The player picks the 300 and taps the scout: all 300 go into it.
  const { swap } = render(store, { picked: 202 });
  const [[picked], [tapped]] = sides() as [string, string][];
  expect(amount()).toBe("300");
  expect(sides()).toEqual([
    [picked, "0"],
    [tapped, "500"],
  ]);
  expect(struckXp()).toBe("100 XP");
  await act(async () => button(`Merge into ${tapped}`)!.click());
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

it("starts the amount again from the armies' new troops when they change while it is open, and sends only what one holds", async () => {
  const store = twoArmies();
  const { swap } = render(store);
  const [[picked], [tapped]] = sides() as [string, string][];
  slide(599);
  expect(button(`Move 599 to ${tapped}`)).toBeDefined();

  // A fight and an order land while the card is open: each army now holds 100.
  const now = (id: number) => store.require("ExplorerTroops", { game_id: 1, explorer_id: id });
  const wire = (value: unknown) =>
    JSON.parse(JSON.stringify(value, (_, field) => (typeof field === "bigint" ? field.toString() : field)));
  act(() =>
    store.applyFacts([
      {
        model: "ExplorerTroops",
        key: "0x74",
        value: wire({ ...now(201), troops: { ...now(201).troops, count: 100n * PRECISION } }),
      },
      {
        model: "ExplorerTroops",
        key: "0x92",
        value: wire({ ...now(202), troops: { ...now(202).troops, count: 100n * PRECISION } }),
      },
    ] as never),
  );

  expect(host.textContent).toContain("The armies' troops changed: the amount starts again from what they hold now.");
  expect(amount()).toBe("100");
  // Again a merge into the army tapped, over the new counts: never a count below none.
  expect(sides()).toEqual([
    [picked, "0"],
    [tapped, "200"],
  ]);
  await act(async () => button(`Merge into ${tapped}`)!.click());
  expect(swap).toHaveBeenCalledOnce();
  expect(swap).toHaveBeenCalledWith(
    expect.objectContaining({ from_explorer_id: 201, to_explorer_id: 202, count: Number(100n * PRECISION) }),
  );
});

it.each([99, 101, 100])(
  "shows the merge on the cards: the army tapped stays, the picked one leaves with its XP (the tapped has %s XP)",
  async (tappedXp) => {
    const { swap } = render(transferArmies(0, tappedXp));
    expect(sides()).toEqual([
      ["Army 1", "0"],
      ["Army 2", "1,100"],
    ]);
    // Army 1 has no XP left unspent; what it loses is its upgrade's 100.
    expect(struckXp()).toBe("100 XP");
    expect(host.textContent).toContain(`${tappedXp} XP`);
    // Army 2 holds 100 stamina; the merge leaves it Army 1's 7.
    expect(host.textContent).toContain("100/120→7");
    expect(swap).not.toHaveBeenCalled();
    await act(async () => button("Merge into Army 2")!.click());
    expect(swap).toHaveBeenCalledWith(
      expect.objectContaining({ from_explorer_id: 201, to_explorer_id: 202, count: 600 * Number(PRECISION) }),
    );
  },
);

it("keeps partial transfers free of a merge's losses", async () => {
  const { swap } = render(transferArmies());
  slide(50);
  expect(amount()).toBe("50");
  expect(struckXp()).toBeNull();
  expect(host.textContent).not.toContain("→7");
  expect(sides()).toEqual([
    ["Army 1", "550"],
    ["Army 2", "550"],
  ]);
  await act(async () => button("Move 50 to Army 2")!.click());
  expect(swap).toHaveBeenCalledWith(expect.objectContaining({ count: 50 * Number(PRECISION) }));
});

it.each(["progress", "troops", "stamina", "position", "removed", "day"])(
  "refuses stale %s before signing, even before React renders the new facts",
  async (change) => {
    const store = transferArmies();
    const { swap, close } = render(store);
    const failed = vi.spyOn(toast, "failed").mockReturnValue("changed");
    const send = button("Merge into Army 2")!;
    const wire = (v: unknown) => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x)));
    const changes = {
      progress: {
        model: "ArmyProgress",
        key: "0xf2022",
        value: wire({ ...store.require("ArmyProgress", { game_id: 1, explorer_id: 202 }), xp: 101 }),
      },
      troops: {
        model: "ExplorerTroops",
        key: "0x92",
        value: wire({
          ...store.require("ExplorerTroops", { game_id: 1, explorer_id: 202 }),
          troops: {
            ...store.require("ExplorerTroops", { game_id: 1, explorer_id: 202 }).troops,
            count: 400n * PRECISION,
          },
        }),
      },
      stamina: {
        model: "ArmySlot",
        key: "0x9",
        value: wire({
          ...store.require("ArmySlot", { game_id: 1, structure_id: 7, epoch: 0n, slot: 0 }),
          stamina: { amount: "3", settled_at: "350", remainder: 0 },
        }),
      },
      position: { model: "TileOccupancy", key: "0x94", value: wire({ ...store.entityOccupancy(1, 202), col: 100 }) },
      removed: { model: "ExplorerTroops", key: "0x92", value: null },
    };
    await act(async () => {
      if (change === "day") {
        store.applyFacts([
          { model: "ExplorerTroops", key: "0x74", value: null },
          { model: "ExplorerTroops", key: "0x92", value: null },
        ]);
        store.setSnapshot({ gameId: 1, complete: true, actor: "0x111", timestamp: 401 });
      } else if (change === "position")
        store.applyFacts([{ model: "TileOccupancy", key: "0x93", value: null }, changes.position] as never);
      else store.applyFacts([changes[change as keyof typeof changes]] as never);
      send.click();
    });
    expect(swap).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The armies changed. Review the merge before confirming again." }),
      "The troops could not be moved.",
    );
  },
);

it.each(["0x74", "0x92"])("removes the selected transfer if either army disappears (%s)", (key) => {
  const store = transferArmies();
  const { swap } = render(store);
  expect(button("Merge into Army 2")).toBeDefined();
  act(() => store.applyFacts([{ model: "ExplorerTroops", key, value: null }]));
  expect(host.querySelector('[role="dialog"]')).toBeNull();
  expect(swap).not.toHaveBeenCalled();
});

it("waits for both armies' progress instead of guessing the survivor", () => {
  const store = transferArmies();
  store.applyFacts([{ model: "ArmyProgress", key: "0xf2022", value: null }]);
  const { swap } = render(store);
  expect(host.textContent).toContain("Waiting for both armies’ progress.");
  expect(struckXp()).toBeNull();
  expect(button(/^Move /)!.disabled).toBe(true);
  expect(swap).not.toHaveBeenCalled();
});

it("asks before dissolving an army with a whole upgrade more progression, then sends the chosen direction", async () => {
  const { swap, close } = render(transferArmies(100, 0));
  // Army 1 loses its 100 XP and its upgrade's 100: the card strikes the 200, and the second press says so.
  expect(struckXp()).toBe("200 XP");
  await act(async () => button("Merge into Army 2")!.click());
  expect(swap).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(host.querySelector(".ui-notice")).toBeNull();
  await act(async () => button("Lose 200 XP, merge into Army 2")!.click());
  expect(swap).toHaveBeenCalledOnce();
  expect(swap).toHaveBeenCalledWith(
    expect.objectContaining({
      from_explorer_id: 201,
      to_explorer_id: 202,
      count: 600 * Number(PRECISION),
    }),
  );
  expect(close).toHaveBeenCalledOnce();
});

it("clears confirmation when the amount changes, and lets the stronger army survive without it, picked the other way", async () => {
  const first = render(transferArmies(100, 0));
  await act(async () => button("Merge into Army 2")!.click());
  slide(50);
  expect(button(/^Lose /)).toBeUndefined();
  slide(600);
  expect(button("Merge into Army 2")).toBeDefined();
  expect(first.swap).not.toHaveBeenCalled();
  // Picked the other way on the map, Army 2 goes into Army 1, which keeps its XP: one click sends.
  const { swap } = render(transferArmies(100, 0), { picked: 202 });
  await act(async () => button("Merge into Army 1")!.click());
  expect(swap).toHaveBeenCalledOnce();
  expect(swap).toHaveBeenCalledWith(
    expect.objectContaining({
      from_explorer_id: 202,
      to_explorer_id: 201,
      count: 500 * Number(PRECISION),
    }),
  );
});

it("asks again after progress changes while a loss confirmation is open", async () => {
  const store = transferArmies(100, 0);
  const { swap } = render(store);
  await act(async () => button("Merge into Army 2")!.click());
  const before = store.require("ArmyProgress", { game_id: 1, explorer_id: 201 });
  act(() =>
    store.applyFacts([
      {
        model: "ArmyProgress",
        key: "0xf2012",
        value: {
          ...before,
          explorer_id: "201",
          xp: 101,
        },
      },
    ] as never),
  );
  expect(button(/^Lose /)).toBeUndefined();
  await act(async () => button("Merge into Army 2")!.click());
  expect(swap).not.toHaveBeenCalled();
  expect(struckXp()).toBe("201 XP");
  await act(async () => button("Lose 201 XP, merge into Army 2")!.click());
  expect(swap).toHaveBeenCalledOnce();
});

it("refuses facts arriving just before the final confirmation click", async () => {
  const store = transferArmies(100, 0);
  const { swap, close } = render(store);
  const failed = vi.spyOn(toast, "failed").mockReturnValue("changed");
  await act(async () => button("Merge into Army 2")!.click());
  const confirm = button("Lose 200 XP, merge into Army 2")!;
  await act(async () => {
    const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: 202 });
    store.applyFacts([
      {
        model: "ArmyProgress",
        key: "0xf2022",
        value: {
          ...progress,
          explorer_id: "202",
          xp: 1,
        },
      },
    ] as never);
    confirm.click();
  });
  expect(swap).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
  expect(failed).toHaveBeenCalledWith(
    expect.objectContaining({ message: "The armies changed. Review the merge before confirming again." }),
    "The troops could not be moved.",
  );
});

it("labels the amount's two ends, none and all the picked army holds, each taking it, and takes an amount typed in", async () => {
  const { swap } = render(transferArmies());
  // Army 1 sends none at the left end, all its 600 at the right, where the control opens; only Army 2's card says 1,100.
  const least = host.querySelector<HTMLButtonElement>('button[aria-label="Minimum 0"]')!;
  const most = host.querySelector<HTMLButtonElement>('button[aria-label="Maximum 600"]')!;
  expect(least.textContent).toBe("0");
  expect(most.textContent).toBe("600");
  expect(amount()).toBe("600");

  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(typed(), "1");
    typed().dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(amount()).toBe("1");
  expect(sides()).toEqual([
    ["Army 1", "599"],
    ["Army 2", "501"],
  ]);

  act(() => least.click());
  expect(amount()).toBe("0");
  expect(button("Pick how many to send")!.disabled).toBe(true);
  act(() => most.click());
  expect(amount()).toBe("600");
  await act(async () => button("Merge into Army 2")!.click());
  expect(swap).toHaveBeenCalledWith(expect.objectContaining({ count: 600 * Number(PRECISION) }));
});
