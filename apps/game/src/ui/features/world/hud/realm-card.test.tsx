import { ResourcesIds, StructureType } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const card = vi.hoisted(() => ({
  balances: [] as Array<{ resourceId: number; amount: number }>,
  category: 1 as number,
}));

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 0 }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({
    ui: { showAutomation: false },
    resources: {
      getTiers: () => ({
        essence: [ResourcesIds.Essence],
        food: [ResourcesIds.Wheat],
        military: [ResourcesIds.Knight, ResourcesIds.Crossbowman, ResourcesIds.Paladin],
      }),
    },
  }),
}));
vi.mock("@/ui/features/world/components/entities/hooks/use-structure-entity-detail", () => ({
  useStructureEntityDetail: () => ({
    isLoadingStructure: false,
    isMine: true,
    structure: { base: { category: card.category } },
    structureName: "Egonal",
    resources: { balances: () => card.balances },
    relicEffects: [],
  }),
}));
vi.mock("@/ui/features/world/components/entities/structure-production-summary", () => ({
  useStructureProductionSummary: () => ({ items: [] }),
}));
vi.mock("@/ui/features/world/components/entities/compact-entity-inventory", () => ({
  CompactEntityInventory: () => null,
}));
vi.mock("@/ui/design-system/icon", () => ({ Icon: () => null }));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("@/ui/shared", () => ({ ProductionStatusBadge: () => null }));
vi.mock("@bibliothecadao/eternum", () => ({ divideByPrecision: (amount: number) => amount / 1e9 }));

import { GAME_TASKS } from "../../../../../scripts/game-tasks.mjs";
import { RealmCard } from "./realm-card";

/** The deploy proof's reading of the troops held, run on the page as prove:play runs it. */
const troopsHeld = () => (0, eval)(GAME_TASKS["blitz-deploy"].reading) as number | null;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  card.category = StructureType.Realm;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("the realm card's resources, as the deploy proof reads them", () => {
  it("names each ring by what it holds, so the proof reads the realm's 1,000 Crossbowmen", () => {
    card.balances = [
      { resourceId: ResourcesIds.Wheat, amount: 6_900 * 1e9 },
      { resourceId: ResourcesIds.Crossbowman, amount: 1_000 * 1e9 },
    ];
    act(() => root.render(<RealmCard holding={null} />));

    expect(
      [...host.querySelectorAll('ul[aria-label="Resources"] li')].map((el) => el.getAttribute("aria-label")),
    ).toEqual(["Wheat · 6,900 held", "Crossbowman T1 · 1,000 held"]);
    expect(troopsHeld()).toBe(1000);
  });

  it("adds a ring found mid-game (a first Essence) at the end, leaving every ring where it was", () => {
    card.balances = [
      { resourceId: ResourcesIds.Wheat, amount: 6_900 * 1e9 },
      { resourceId: ResourcesIds.Crossbowman, amount: 1_000 * 1e9 },
    ];
    act(() => root.render(<RealmCard holding={null} />));
    const rings = () =>
      [...host.querySelectorAll('ul[aria-label="Resources"] li')].map((el) => el.getAttribute("aria-label"));
    expect(rings()).toEqual(["Wheat · 6,900 held", "Crossbowman T1 · 1,000 held"]);

    card.balances = [...card.balances, { resourceId: ResourcesIds.Essence, amount: 50 * 1e9 }];
    act(() => root.render(<RealmCard holding={null} />));
    expect(rings()).toEqual(["Wheat · 6,900 held", "Crossbowman T1 · 1,000 held", "Essence · 50 held"]);
  });

  it("reads 0 troops for a realm whose named rings hold none", () => {
    card.balances = [{ resourceId: ResourcesIds.Wheat, amount: 500 * 1e9 }];
    act(() => root.render(<RealmCard holding={null} />));

    expect(troopsHeld()).toBe(0);
  });
});

describe("the deploy proof's reading", () => {
  it("is unavailable, not 0, on a card whose rings carry no names", () => {
    host.innerHTML = `<section aria-label="Selected holding"><ul aria-label="Resources"><li></li><li></li></ul></section>`;

    expect(troopsHeld()).toBeNull();
  });
});

describe("the line under the card's header", () => {
  /** What the card shows first under its header: the holding's line, else its rings. */
  const firstUnderHeader = () => host.querySelector('[aria-label="Selected holding"] .min-w-0.flex-col > :first-child');
  const holding = (category: StructureType) =>
    ({
      structure: { base: { category } },
      population: 2,
      populationCapacity: 12,
      buildingTilesOccupied: null,
      buildingTilesTotal: null,
    }) as never;

  it("reads a realm's population there", () => {
    card.balances = [{ resourceId: ResourcesIds.Wheat, amount: 1_000 * 1e9 }];
    act(() => root.render(<RealmCard holding={holding(StructureType.Realm)} />));

    expect(firstUnderHeader()?.textContent).toBe("2/12");
  });

  it("leaves no empty line on an Essence Rift, which has no population or automation: its rings come first", () => {
    card.category = StructureType.Mine;
    card.balances = [{ resourceId: ResourcesIds.Essence, amount: 280 * 1e9 }];
    act(() => root.render(<RealmCard holding={holding(StructureType.Mine)} />));

    expect(firstUnderHeader()?.getAttribute("aria-label")).toBe("Resources");
  });
});
