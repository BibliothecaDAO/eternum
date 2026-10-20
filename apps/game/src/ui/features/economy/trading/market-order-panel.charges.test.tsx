// @vitest-environment jsdom
import { configManager } from "@bibliothecadao/eternum";
import { ResourcesIds, type MarketInterface } from "@bibliothecadao/types";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only the boundaries are stubbed: the game's mode, the chain's clock and balances, the sound, the dialog's frame and
// the donkey maths. The order form, the order row, the forms they open and every figure they write are the real ones.
// Frontier: placing an order asks first, so its confirmation spells the order out.
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: "frontier" }) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 1,
  useCurrentBlockTimestamp: () => 1000,
}));
vi.mock("@/audio", () => ({ useUISound: () => () => undefined }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    account: { account: {} },
    setup: { store: { get: () => undefined }, systemCalls: { create_order: vi.fn(), accept_order: vi.fn() } },
  }),
}));
vi.mock("@/hooks/helpers/use-resources", () => ({
  useResourceManager: () => ({
    balance: () => 10n ** 30n,
    balanceWithProduction: () => ({ balance: 10 ** 30 }),
  }),
}));
vi.mock("@/ui/design-system/molecules/popover", () => ({
  PopoverPanel: ({ children }: { children: ReactNode }) => <section data-confirm>{children}</section>,
}));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  calculateDonkeysNeeded: () => 1,
  getTotalResourceWeightKg: () => 1,
}));

import { OrderCreation, OrderRow } from "./market-order-panel";

const PRECISION = 1_000_000_000;
let unmount: (() => void) | undefined;

const render = (element: ReactNode) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(element));
  unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return host;
};

const press = (host: HTMLElement, label: string) => {
  const button = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
  expect(button?.disabled).toBe(false);
  act(() => button!.click());
};

beforeEach(() => {
  vi.spyOn(configManager, "getActiveGameId").mockReturnValue(1);
});
afterEach(() => {
  unmount?.();
  vi.restoreAllMocks();
});

describe("a new order's charge, on the form and its confirmation", () => {
  // The form starts at 100 Wheat: the price each sets what the order costs.
  it.each([
    { each: 0.0025, shownEach: "0.0025", cost: "<1" },
    { each: 0.0125, shownEach: "0.013", cost: "1" },
    { each: 124, shownEach: "124", cost: "12.4K" },
  ])("buying 100 Wheat at $each LORDS each costs $cost LORDS, rounded", ({ each, shownEach, cost }) => {
    const host = render(
      <OrderCreation entityId={1} resourceId={ResourcesIds.Wheat} isBuy layout="compact" suggestedPrice={each} />,
    );
    expect(host.textContent).toContain(`Cost${cost}`);

    press(host, "Buy 100 Wheat");

    expect(host.querySelector("[data-confirm]")?.textContent).toContain(
      `100 Wheat for ${cost} LORDS, at ${shownEach} LORDS each.`,
    );
  });
});

describe("filling an offer: what it takes, on the book and in the confirmation", () => {
  const offer = (wheat: number, lords: number): MarketInterface => ({
    makerName: "seller",
    originName: "Stolsli",
    tradeId: 7,
    makerId: 2,
    takerId: 0,
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: 2_000_000_000,
    makerGets: [{ resourceId: ResourcesIds.Wheat, amount: wheat * PRECISION }],
    takerGets: [{ resourceId: ResourcesIds.Lords, amount: lords * PRECISION }],
    ratio: lords / wheat,
    perLords: lords / wheat,
  });

  it.each([
    { wheat: 100, lords: 0.25, shown: ["100", "<1"] },
    { wheat: 3, lords: 1.25, shown: ["3", "1"] },
    { wheat: 50_000, lords: 12_400, shown: ["50K", "12.4K"] },
  ])(
    "selling into a bid for $wheat Wheat takes $lords LORDS, rounded as every charge reads",
    ({ wheat, lords, shown }) => {
      const host = render(
        <OrderRow
          offer={offer(wheat, lords)}
          entityId={1}
          isBuy
          updateBalance={false}
          setUpdateBalance={() => undefined}
        />,
      );
      const [amount, , total] = [...host.querySelector('[role="row"]')!.children].map((cell) => cell.textContent);
      expect([amount, total]).toEqual(shown);

      press(host, "Sell");

      expect(host.querySelector("[data-confirm]")?.textContent).toContain(
        `Sell ${shown[0]} Wheat for ${shown[1]} LORDS`,
      );
    },
  );
});
