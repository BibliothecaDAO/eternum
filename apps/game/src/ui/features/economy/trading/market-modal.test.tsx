import {
  COMPACT_HUD_MEDIA_QUERY,
  COMPACT_LANDSCAPE_MEDIA_QUERY,
  type CompactLane,
} from "@/hooks/helpers/use-compact-hud";
import { useMarketStore } from "@/hooks/store/use-market-store";
import { ResourcesIds } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/audio/hooks/useAudio", () => ({ useAudio: () => ({ play: vi.fn() }) }));
vi.mock("@bibliothecadao/eternum", () => ({
  getBlockTimestamp: () => ({ currentBlockTimestamp: 0, currentDefaultTick: 0 }),
}));
vi.mock("@bibliothecadao/react", () => ({
  useMarket: () => ({ bidOffers: [], askOffers: [] }),
  useResourceManager: () => ({ balanceWithProduction: () => ({ balance: 0n }) }),
}));
vi.mock("@/hooks/store/use-ui-store", async () => {
  const { create } = await import("zustand");
  return { useUIStore: create(() => ({ structureEntityId: 7, playerStructures: [] })) };
});
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ structure: { getName: () => ({ name: "Realm" }) } }),
}));
vi.mock("@/ui/utils/utils", () => ({ currencyFormat: (value: number) => String(value) }));
vi.mock("@/ui/design-system/molecules/requirement-chips", () => ({ REQUIREMENT_CHIP: "" }));
vi.mock("@/ui/design-system/molecules/resource-icon", () => ({
  ResourceIcon: ({ resource }: { resource: string }) => <i data-resource={resource} />,
}));
vi.mock("./trade-summary-bar", () => ({ TradeSummaryBar: () => <span>Open orders</span> }));
vi.mock("./market-resource-sidebar", () => ({
  MarketResourceSidebar: ({
    onClick,
    selectedResource,
  }: {
    onClick: (resourceId: number) => void;
    selectedResource: number;
  }) => (
    <aside aria-label="Resource list" data-selected={selectedResource}>
      <button type="button" onClick={() => onClick(ResourcesIds.Stone)}>
        Stone
      </button>
    </aside>
  ),
}));
vi.mock("./market-order-panel", () => ({
  MarketOrderPanel: ({ resourceId }: { resourceId: number }) => (
    <article data-resource={resourceId}>Order book</article>
  ),
}));
vi.mock("@/ui/features/economy/banking", async () => {
  const { BankPanel } = await import("@/ui/features/economy/banking/bank-list");
  return { BankList: BankPanel };
});
vi.mock("@/ui/features/economy/banking/swap", () => ({
  ResourceSwap: () => <article>Swap form</article>,
}));
vi.mock("@/ui/features/economy/banking/add-liquidity", () => ({
  default: ({ listResourceId }: { listResourceId: number }) => (
    <article data-resource={listResourceId}>Liquidity form</article>
  ),
}));
vi.mock("@/ui/features/economy/banking/liquidity-table", () => ({ LiquidityTable: () => null }));
vi.mock("./market-trading-history", () => ({ MarketTradingHistory: () => <article>History</article> }));

import { MarketModal } from "./market-modal";

/** The compact lane is two media queries (`use-compact-hud`); the modal reads them, so the test answers both. */
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

let container: HTMLDivElement;
let root: Root;

const resourceList = () => container.querySelector('[aria-label="Resource list"]');
const isVisible = (element: Element) => !element.closest("[hidden]");
const orderBook = () => [...container.querySelectorAll("article")].find(isVisible) ?? null;
const tabs = () => [...container.querySelectorAll('[role="tab"]')].filter(isVisible).map((tab) => tab.textContent);
const button = (label: string) =>
  [...container.querySelectorAll("button")].find(
    (candidate) => isVisible(candidate) && candidate.textContent === label,
  );
const tap = (label: string) => act(async () => button(label)!.click());

const mount = async (lane: CompactLane | null) => {
  stubCompactLane(lane);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<MarketModal />));
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useMarketStore.setState({ selectedResource: ResourcesIds.Wood });
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe("MarketModal", () => {
  it("shows the resource list beside the trade view on desktop", async () => {
    await mount(null);
    expect(resourceList()).not.toBeNull();
    expect(tabs()).toEqual(["Order Book", "AMM", "History"]);
    expect(orderBook()?.getAttribute("data-resource")).toBe(String(ResourcesIds.Wood));
    expect(button("Change")).toBeUndefined();
  });

  it.each(["portrait", "landscape"] as const)(
    "opens on the trade view for the selected resource without the list in %s",
    async (lane) => {
      await mount(lane);
      expect(resourceList()).toBeNull();
      expect(container.querySelector("[data-resource='Wood']")).not.toBeNull();
      expect(button("Change")).toBeDefined();
      expect(tabs()).toEqual(["Order Book", "AMM", "History"]);
      expect(orderBook()?.textContent).toBe("Order book");
    },
  );

  it("swaps the trade view for the resource list when the player taps Change", async () => {
    await mount("portrait");
    await tap("Change");
    expect(resourceList()?.getAttribute("data-selected")).toBe(String(ResourcesIds.Wood));
    expect(orderBook()).toBeNull();
    expect(button("Change")).toBeUndefined();
  });

  it("selects the picked resource and returns to the trade view", async () => {
    await mount("portrait");
    await tap("Change");
    await tap("Stone");
    expect(useMarketStore.getState().selectedResource).toBe(ResourcesIds.Stone);
    expect(resourceList()).toBeNull();
    expect(container.querySelector("[data-resource='Stone']")).not.toBeNull();
    expect(orderBook()?.getAttribute("data-resource")).toBe(String(ResourcesIds.Stone));
  });

  it("keeps the open tab across a resource change", async () => {
    await mount("portrait");
    await tap("AMM");
    await tap("Change");
    await tap("Stone");
    expect(orderBook()?.textContent).toBe("Swap form");
  });

  it.each(["portrait", "landscape"] as const)(
    "keeps the AMM Pools tab open when changing resources in %s",
    async (lane) => {
      await mount(lane);
      await tap("AMM");
      await tap("Pools");
      expect(orderBook()?.textContent).toBe("Liquidity form");
      await tap("Change");
      expect(orderBook()).toBeNull();
      await tap("Stone");
      expect(button("Pools")?.getAttribute("aria-selected")).toBe("true");
      expect(orderBook()?.textContent).toBe("Liquidity form");
      expect(orderBook()?.getAttribute("data-resource")).toBe(String(ResourcesIds.Stone));
    },
  );
});
