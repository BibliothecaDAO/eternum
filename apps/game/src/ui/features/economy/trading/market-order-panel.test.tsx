// @vitest-environment jsdom
import { RESOURCE_PRECISION, ResourcesIds, StructureType, type MarketInterface } from "@bibliothecadao/types";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The market as a player uses it: only the game's calls, the structure's balances and the game mode are stood in for. */
const world = vi.hoisted(() => ({
  mode: "blitz" as "blitz" | "eternum" | "frontier",
  calls: { accept_order: vi.fn(), cancel_order: vi.fn(), create_order: vi.fn() },
}));

vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      systemCalls: world.calls,
      store: { get: () => ({ base: { category: StructureType.Realm } }) },
    },
    account: { account: { address: "0x1" } },
  }),
}));
/** The structure holds 1,000 of everything, at the game's precision. */
vi.mock("@/hooks/helpers/use-resources", () => ({
  useResourceManager: () => ({
    balance: () => 1_000 * RESOURCE_PRECISION,
    balanceWithProduction: () => ({ balance: 1_000 * RESOURCE_PRECISION }),
  }),
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 0,
  useCurrentBlockTimestamp: () => 1_000,
}));
vi.mock("@/hooks/helpers/use-compact-hud", () => ({ useCompactLane: () => null }));
vi.mock("@/audio", () => ({ useUISound: () => () => {} }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: world.mode }) }));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  PopoverPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({ ResourceIcon: () => null }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/eternum")>();
  vi.spyOn(actual.configManager, "getActiveGameId").mockReturnValue(1);
  return { ...actual, getTotalResourceWeightKg: () => 0, calculateDonkeysNeeded: () => 0 };
});

import { OrderCreation, OrderRow } from "./market-order-panel";

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  Object.values(world.calls).forEach((call) => call.mockReset().mockResolvedValue(undefined));
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const STRUCTURE = 7;
/** An ask of 10 wheat for 5 Lords, placed by this structure or another. */
const ask = (makerId: number): MarketInterface =>
  ({
    tradeId: 99,
    makerId,
    makerGets: [{ resourceId: ResourcesIds.Lords, amount: 5 * RESOURCE_PRECISION }],
    takerGets: [{ resourceId: ResourcesIds.Wheat, amount: 10 * RESOURCE_PRECISION }],
    ratio: 0.5,
    perLords: 0.5,
    expiresAt: 2_000,
    makerGivesMinResourceAmount: 1,
  }) as unknown as MarketInterface;

const render = (node: ReactNode) => act(() => root.render(node));
const button = (text: string) => [...host.querySelectorAll("button")].find((each) => each.textContent === text)!;
const press = async (text: string) => {
  await act(async () => button(text).click());
};
const typeInto = (label: string, text: string) =>
  act(() => {
    const input = host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

const ownOrder = () => render(<OrderRow offer={ask(STRUCTURE)} entityId={STRUCTURE} isBuy={false} />);

describe("cancelling your own order", () => {
  it.each(["blitz", "eternum"] as const)("acts at once in %s", async (mode) => {
    world.mode = mode;
    ownOrder();
    await press("Cancel");
    expect(world.calls.cancel_order).toHaveBeenCalledTimes(1);
    expect(world.calls.cancel_order.mock.calls[0][0]).toMatchObject({ trade_id: 99 });
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("asks first in Frontier: keeping it sends nothing, confirming sends one cancel", async () => {
    world.mode = "frontier";
    ownOrder();
    await press("Cancel");
    expect(host.querySelector('[role="alertdialog"]')).not.toBeNull();
    await press("Keep it");
    expect(world.calls.cancel_order).not.toHaveBeenCalled();
    await press("Cancel");
    await press("Cancel order");
    expect(world.calls.cancel_order).toHaveBeenCalledTimes(1);
  });
});

describe("taking an offer", () => {
  it("asks how much in every mode, and takes the typed whole amount", async () => {
    world.mode = "blitz";
    render(<OrderRow offer={ask(3)} entityId={STRUCTURE} isBuy={false} />);
    await press("Buy");
    expect(world.calls.accept_order).not.toHaveBeenCalled();
    typeInto("Wheat to buy", "4.9");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Wheat to buy"]')!.value).toBe("4");
    const dialog = host.querySelector('[role="dialog"]')!;
    await act(async () => [...dialog.querySelectorAll("button")].find((each) => each.textContent === "Buy")!.click());
    expect(world.calls.accept_order).toHaveBeenCalledTimes(1);
    // 4 wheat of the ask, in its smallest lots.
    expect(world.calls.accept_order.mock.calls[0][0]).toMatchObject({
      taker_id: STRUCTURE,
      trade_id: 99,
      taker_buys_count: 4 * RESOURCE_PRECISION,
    });
  });
});

describe("placing an order", () => {
  const form = () => render(<OrderCreation entityId={STRUCTURE} resourceId={ResourcesIds.Wheat} isBuy />);

  it("reads a typed decimal price and places the order at once in Blitz", async () => {
    world.mode = "blitz";
    form();
    typeInto("Lords per Wheat", "0.25");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Lords to pay"]')!.value).toBe("25");
    await press("Buy 100 Wheat");
    expect(world.calls.create_order).toHaveBeenCalledTimes(1);
    expect(world.calls.create_order.mock.calls[0][0]).toMatchObject({
      maker_id: STRUCTURE,
      maker_gives_resource_type: ResourcesIds.Lords,
      taker_pays_resource_type: ResourcesIds.Wheat,
    });
  });

  it("asks first in Frontier", async () => {
    world.mode = "frontier";
    form();
    await press("Buy 100 Wheat");
    expect(world.calls.create_order).not.toHaveBeenCalled();
    const confirm = host.querySelector('[role="alertdialog"]')!;
    await act(async () =>
      [...confirm.querySelectorAll("button")].find((each) => each.textContent === "Buy 100 Wheat")!.click(),
    );
    expect(world.calls.create_order).toHaveBeenCalledTimes(1);
  });
});

/** The game's answer to a send, held until the test gives it: accepted, or refused. */
const held = (call: ReturnType<typeof vi.fn>) => {
  let answer!: (refused: boolean) => void;
  call.mockImplementation(
    () =>
      new Promise<void>((resolve, reject) => {
        answer = (refused) => (refused ? reject(new Error("refused")) : resolve());
      }),
  );
  return (refused = false) =>
    act(async () => {
      answer(refused);
    });
};
const pressIn = async (scope: ParentNode, text: string) => {
  await act(async () => [...scope.querySelectorAll("button")].find((each) => each.textContent === text)!.click());
};
const confirmDialog = () => host.querySelector('[role="alertdialog"]')!;

describe("a market send in flight", () => {
  it.each(["accepted", "refused"] as const)(
    "places one order while Frontier's confirm waits, and again after the first was %s",
    async (answered) => {
      world.mode = "frontier";
      vi.spyOn(console, "error").mockImplementation(() => {});
      render(<OrderCreation entityId={STRUCTURE} resourceId={ResourcesIds.Wheat} isBuy />);
      const answer = held(world.calls.create_order);
      await press("Buy 100 Wheat");
      await pressIn(confirmDialog(), "Buy 100 Wheat");
      await pressIn(confirmDialog(), "Buy 100 Wheat");
      expect(world.calls.create_order).toHaveBeenCalledTimes(1);
      await answer(answered === "refused");
      await press("Buy 100 Wheat");
      await pressIn(confirmDialog(), "Buy 100 Wheat");
      expect(world.calls.create_order).toHaveBeenCalledTimes(2);
      await answer();
    },
  );

  it("places one order in Blitz while it waits, and again once answered", async () => {
    world.mode = "blitz";
    render(<OrderCreation entityId={STRUCTURE} resourceId={ResourcesIds.Wheat} isBuy />);
    const answer = held(world.calls.create_order);
    const verb = button("Buy 100 Wheat");
    await act(async () => verb.click());
    await act(async () => verb.click());
    expect(world.calls.create_order).toHaveBeenCalledTimes(1);
    await answer();
    await press("Buy 100 Wheat");
    expect(world.calls.create_order).toHaveBeenCalledTimes(2);
    await answer();
  });

  it("cancels one order while Frontier's confirm waits, and closes it once answered", async () => {
    world.mode = "frontier";
    ownOrder();
    const answer = held(world.calls.cancel_order);
    await press("Cancel");
    await pressIn(confirmDialog(), "Cancel order");
    await pressIn(confirmDialog(), "Cancel order");
    expect(world.calls.cancel_order).toHaveBeenCalledTimes(1);
    await answer();
    expect(host.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it("takes an offer once while its send waits", async () => {
    world.mode = "blitz";
    render(<OrderRow offer={ask(3)} entityId={STRUCTURE} isBuy={false} />);
    const answer = held(world.calls.accept_order);
    await press("Buy");
    const take = [...host.querySelector('[role="dialog"]')!.querySelectorAll("button")].find(
      (each) => each.textContent === "Buy",
    )!;
    await act(async () => take.click());
    await act(async () => take.click());
    expect(world.calls.accept_order).toHaveBeenCalledTimes(1);
    await answer();
  });
});
