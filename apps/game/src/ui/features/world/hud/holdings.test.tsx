import { StructureType } from "@bibliothecadao/types";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const facts = vi.hoisted(() => ({ structures: [] as unknown[], mode: "blitz" }));

vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({ id: facts.mode }) }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => vi.fn() }));
vi.mock("@/hooks/helpers/use-query", () => ({ useQuery: () => ({ isMapView: true }) }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => facts.structures }));
vi.mock("@/sync/fact-views", () => ({ playerStructuresView: {} }));
vi.mock("@/ui/features/world/containers/top-header/structure-picker/use-structures-with-metadata", () => ({
  useStructuresWithMetadata: () => facts.structures,
}));
vi.mock("@/ui/features/world/containers/top-header/structure-picker/chip", () => ({
  StructureRealmActions: () => null,
}));
vi.mock("@/ui/features/world/containers/top-header/favorites", () => ({
  useFavoriteStructures: () => ({ toggleFavorite: vi.fn() }),
}));
vi.mock("./medallion", () => ({ Medallion: () => null }));
vi.mock("@bibliothecadao/eternum", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum")>()),
  Position: {},
  structureMapPosition: () => null,
}));

import { useUIStore } from "@/hooks/store/use-ui-store";
import { HoldingsList, useHoldings } from "./holdings";

const FRAGMENT_MINE = 2;
const holding = (entityId: number, category: StructureType, displayName: string) => ({
  entityId,
  category,
  displayName,
  realmLevel: 0,
  realmLevelLabel: category === StructureType.Realm ? "Settlement" : null,
  isFavorite: false,
  structure: { base: { category }, metadata: { mine_kind: FRAGMENT_MINE } },
});

const realms = (count: number) =>
  Array.from({ length: count }, (_, index) => holding(index + 1, StructureType.Realm, `Realm ${index + 1}`));

const Holdings = () => <HoldingsList holdings={useHoldings()} />;

let host: HTMLDivElement;
let root: Root;

const render = () => act(() => root.render(<Holdings />));
const searchField = () => host.querySelector<HTMLInputElement>('input[type="search"]');
/** Each row's name, as its ring names the holding, inside the button that selects it (beside its star and controls). */
const shownNames = () =>
  [...host.querySelectorAll('[role="tabpanel"] button[aria-pressed]:not([aria-label]) [role="img"]')].map((el) =>
    el.getAttribute("aria-label"),
  );

/** Types into the search field as a player does: the field's value, then its input event. */
const type = (text: string) =>
  act(() => {
    const field = searchField()!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, text);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });

describe("the holdings search", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    facts.mode = "blitz";
    useUIStore.getState().setLeftListFilter("all");
    host = document.createElement("div");
    root = createRoot(host);
  });
  afterEach(() => act(() => root.unmount()));

  it.each([
    ["frontier", "Trolls", "beast-troll"],
    ["blitz", "Camps", "camp"],
  ])("names and paints the %s list by its encounter", (mode, plural, icon) => {
    facts.mode = mode;
    facts.structures = [...realms(1), holding(50, StructureType.Camp, plural === "Trolls" ? "Troll" : "Camp")];
    render();
    const tab = host.querySelector<HTMLButtonElement>(`[role="tab"][aria-label="${plural}, 1"]`);
    expect(tab).not.toBeNull();
    act(() => tab!.click());
    expect(shownNames()).toEqual([mode === "frontier" ? "Troll" : "Camp"]);
    const painting = host.querySelector(`[role="tabpanel"] [role="img"] img`);
    expect(painting?.getAttribute("data-icon")).toBe(icon);
    expect(painting?.getAttribute("src")).toBe(`/icons/facets/64/${icon}.webp`);
    if (mode === "frontier") expect(host.textContent).not.toMatch(/\bcamps?\b/i);
  });

  it("filters only the kind it was typed in: another kind's tab shows all its holdings", () => {
    facts.structures = [...realms(12), holding(50, StructureType.Mine, "Copper Mine")];
    render();
    type("Realm 1");
    expect(shownNames()).toEqual(["Realm 1", "Realm 10", "Realm 11", "Realm 12"]);

    act(() => host.querySelector<HTMLButtonElement>('[role="tab"][aria-label="Fragment Mines, 1"]')!.click());

    expect(searchField()).toBeNull();
    expect(shownNames()).toEqual(["Copper Mine"]);
  });

  it("says nothing matches only once something was searched, and that nothing is held otherwise", () => {
    facts.structures = [];
    render();
    expect(host.querySelector('[role="tabpanel"]')!.textContent).toBe("You hold nothing.");

    facts.structures = realms(12);
    render();
    type("Nowhere");
    expect(host.querySelector('[role="tabpanel"]')!.textContent).toBe("No holding matches.");
  });

  it("stops filtering once its kind falls under the search's threshold and the field goes", () => {
    facts.structures = realms(12);
    render();
    type("Realm 1");

    facts.structures = realms(11);
    render();

    expect(searchField()).toBeNull();
    expect(shownNames()).toHaveLength(11);
  });
});
