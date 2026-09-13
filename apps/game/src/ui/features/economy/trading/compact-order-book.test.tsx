import {
  COMPACT_HUD_MEDIA_QUERY,
  COMPACT_LANDSCAPE_MEDIA_QUERY,
  type CompactLane,
} from "@/hooks/helpers/use-compact-hud";
import { ResourcesIds, type MarketInterface } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio", () => ({ useUISound: () => vi.fn() }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentBlockTimestamp: () => 1_000,
  useCurrentDefaultTick: () => 0,
}));
vi.mock("@/sync/game-scope", () => ({ gameEntityKey: () => "" }));
vi.mock("@dojoengine/recs", () => ({ getComponentValue: () => undefined }));
vi.mock("@bibliothecadao/eternum", () => ({
  calculateDonkeysNeeded: () => 0,
  divideByPrecision: (value: number) => value,
  getTotalResourceWeightKg: () => 0,
  isMilitaryResource: () => false,
  multiplyByPrecision: (value: number) => value,
}));
vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    account: { account: {} },
    setup: { components: { Structure: {} }, systemCalls: {} },
  }),
  useResourceManager: () => ({
    balance: () => 0n,
    balanceWithProduction: () => ({ balance: 0 }),
  }),
}));
// Rows have no layout in jsdom, so the virtualizer stands in with one that renders every row.
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, start: index * 40 })),
    measure: vi.fn(),
  }),
}));
vi.mock("@/ui/utils/utils", () => ({
  currencyFormat: (value: number) => String(value),
  formatNumber: (value: number) => String(value),
}));
vi.mock("@/ui/design-system/atoms/number-input", () => ({
  NumberInput: ({ value, onChange }: { value: number; onChange: (value: number) => void }) => (
    <input value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} />
  ),
}));
vi.mock("@/ui/design-system/molecules/requirement-chips", () => ({ REQUIREMENT_CHIP: "" }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <i data-resource={resource} />,
}));
vi.mock("@/ui/features/economy/banking", () => ({ ConfirmationPopup: () => null }));

import { CompactOrderBook } from "./compact-order-book";
import { MarketOrderPanel } from "./market-order-panel";

const stubCompactLane = (lane: CompactLane | null) => {
  const answers: Record<string, boolean> = {
    [COMPACT_HUD_MEDIA_QUERY]: lane !== null,
    [COMPACT_LANDSCAPE_MEDIA_QUERY]: lane === "landscape",
  };
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: answers[media] ?? false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

/** A Wood offer: a bid is made by whoever gets Wood, an ask by whoever gets Lords. Ratio ranks best first. */
const woodOffer = (side: "bid" | "ask", tradeId: number, perLords: number): MarketInterface => {
  const wood = { resourceId: ResourcesIds.Wood, amount: 100 };
  const lords = { resourceId: ResourcesIds.Lords, amount: 100 * perLords };
  return {
    tradeId,
    makerId: 9,
    takerId: 0,
    makerName: "",
    originName: "",
    makerOrder: 0,
    makerGivesMinResourceAmount: 1,
    takerPaysMinResourceAmount: 1,
    makerGivesMaxResourceCount: 1,
    expiresAt: 0,
    makerGets: [side === "bid" ? wood : lords],
    takerGets: [side === "bid" ? lords : wood],
    ratio: side === "bid" ? perLords : 1 / perLords,
    perLords,
  };
};

const ASK_PRICES = [0.5, 0.6, 0.7, 0.8, 0.9];
const BID_PRICES = [0.4, 0.3];
const asks = ASK_PRICES.map((price, index) => woodOffer("ask", 100 + index, price));
const bids = BID_PRICES.map((price, index) => woodOffer("bid", 200 + index, price));

let container: HTMLDivElement;
let root: Root;

const text = () => container.textContent ?? "";
const offerRows = () => container.querySelectorAll('[title^="Expires"]').length;
/** Each row's price cell, in display order. */
const rowPrices = () =>
  [...container.querySelectorAll('[title^="Expires"]')].map((row) => row.children[1]?.textContent);
const tab = (label: string) => [...container.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === label);
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((candidate) => candidate.textContent === label);
const tap = (element: Element | undefined) => act(async () => (element as HTMLElement).click());
const form = () => container.querySelector(".order-create-buy-selector, .order-create-sell-selector")!;
const priceInput = () => form().querySelectorAll("input")[1];

const mount = async (lane: CompactLane | null) => {
  stubCompactLane(lane);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const book = { resourceId: ResourcesIds.Wood, entityId: 7, resourceAskOffers: asks, resourceBidOffers: bids };
  await act(async () =>
    root.render(lane === null ? <MarketOrderPanel {...book} /> : <CompactOrderBook {...book} lane={lane} />),
  );
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("CompactOrderBook", () => {
  it("starts in Buy mode with the asks and a buy form", async () => {
    await mount("portrait");
    expect(tab("Buy")?.getAttribute("aria-selected")).toBe("true");
    expect(tab("Sell")?.getAttribute("aria-selected")).toBe("false");
    expect(text()).toContain("Buy from0.5Lords each5 asks");
    expect(form().classList.contains("order-create-buy-selector")).toBe(true);
    expect(button("Buy 100 Wood")).toBeDefined();
    expect(container.querySelector(".order-sell-selector")).not.toBeNull();
  });

  it("switches to the bids and a sell form in Sell mode", async () => {
    await mount("portrait");
    await tap(tab("Sell"));
    expect(tab("Sell")?.getAttribute("aria-selected")).toBe("true");
    expect(text()).toContain("Sell to0.4Lords each2 bids");
    expect(form().classList.contains("order-create-sell-selector")).toBe(true);
    expect(button("Sell 100 Wood")).toBeDefined();
    expect(container.querySelector(".order-buy-selector")).not.toBeNull();
  });

  it("shows the three best offers until See all, then the whole side", async () => {
    await mount("portrait");
    expect(rowPrices()).toEqual(["0.5", "0.6", "0.7"]);
    await tap(button("See all 5"));
    expect(rowPrices()).toEqual(["0.5", "0.6", "0.7", "0.8", "0.9"]);
    await tap(button("Show less"));
    expect(offerRows()).toBe(3);
  });

  it("prefills the price with the best offer of the current mode until the player types one", async () => {
    await mount("portrait");
    expect(priceInput().value).toBe("0.5");
    await tap(tab("Sell"));
    expect(priceInput().value).toBe("0.4");
    await act(async () => {
      const input = priceInput();
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setValue.call(input, "0.42");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(priceInput().value).toBe("0.42");
    await tap(tab("Buy"));
    expect(priceInput().value).toBe("0.42");
  });

  it("keeps the offers behind the header in landscape until tapped", async () => {
    await mount("landscape");
    expect(offerRows()).toBe(0);
    expect(button("See all 5")).toBeUndefined();
    await tap(container.querySelector("[aria-expanded]")!);
    expect(offerRows()).toBe(3);
  });

  it("leaves the desktop book as two columns without a toggle", async () => {
    await mount(null);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector(".order-sell-selector")).not.toBeNull();
    expect(container.querySelector(".order-buy-selector")).not.toBeNull();
    expect(container.querySelector(".order-create-sell-selector")).not.toBeNull();
    expect(container.querySelector(".order-create-buy-selector")).not.toBeNull();
    expect(offerRows()).toBe(7);
  });
});
