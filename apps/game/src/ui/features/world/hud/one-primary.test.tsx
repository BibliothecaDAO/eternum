import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: unknown) => unknown) =>
    select({ structureEntityId: 1, arrivedArrivalStructureIds: [1] }),
}));
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true }));
vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: { inGame: () => [] } } }) }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useCurrentDefaultTick: () => 1, useNowMs: () => 1000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/hooks/helpers/use-navigate", () => ({ useGoToStructure: () => vi.fn() }));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => [{ entityId: 1, structure: {} }] }));
vi.mock("@/sync/fact-views", () => ({ playerStructuresView: {} }));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({
  useGameModeConfig: () => ({ structure: { getName: () => ({ name: "Realm" }) } }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  ResourceManager: class {
    current() {
      return undefined;
    }
  },
  configManager: { getActiveGameId: () => 1 },
  Position: {},
  structureMapPosition: () => null,
}));
// A ready Blitz realm: Next up offers its Provision, as does its Castle's panel.
vi.mock("@/ui/modules/entity-details/hooks/use-realm-level-up", () => ({
  useRealmLevelUp: () => ({
    mode: "provision",
    ready: true,
    loading: false,
    word: "Provision",
    requirements: [],
    nextLevel: 0,
    run: vi.fn(),
  }),
}));
vi.mock("@/ui/modules/entity-details/hooks/use-structure-upgrade", () => ({
  useStructureUpgrade: () => ({ isOwner: true, currentLevel: 0 }),
}));
// Resources arrived at the selected realm, and another realm, North, can take its step: Next up's queue holds the
// selected realm's Provision, then the arrival, then North's step.
vi.mock("@/ui/features/world/containers/left-facets/use-empire-suggestions", () => ({
  useEmpireSuggestions: () => [{ id: "s2", realmId: 2, realmName: "North" }],
}));
vi.mock("@/ui/features/world/containers/left-facets/use-suggestion-actions", () => ({
  isOrderSuggestion: () => false,
  useSuggestionActions: () => ({ handleSuggestionClick: vi.fn(), pendingSuggestionIds: [] }),
}));
vi.mock("@/ui/features/world/containers/left-facets/suggestions-panel", () => ({ SuggestionsPanel: () => null }));

import { AttentionPill } from "@/ui/features/world/containers/top-header/attention-pill";
import { RealmUpgradeCompact } from "@/ui/modules/entity-details/realm/realm-details";
import { NextUp } from "./next-up";

let host: HTMLDivElement;
let root: Root;

/** The filled gold buttons on screen, by their words: the kit's primary, the Castle's amber fill, Attention's gold. */
const filledGold = () =>
  [...host.querySelectorAll("button")]
    .filter((button) =>
      ["frontier-primary", "bg-amber-400/90", "bg-gold"].some((name) => button.classList.contains(name)),
    )
    .map((button) => button.textContent?.trim());

describe("one filled gold action at a time", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div");
    root = createRoot(host);
  });
  afterEach(() => act(() => root.unmount()));

  it("leaves the ready Castle's Provision outlined whatever step Next up shows, as on a desktop", () => {
    act(() =>
      root.render(
        <>
          <NextUp />
          <RealmUpgradeCompact />
        </>,
      ),
    );
    const nextUp = () => host.querySelector('section[aria-label="Next up"]')!;
    const advance = () =>
      act(() => [...nextUp().querySelectorAll("button")].find((b) => b.textContent?.includes("›"))!.click());
    const shown: string[] = [];
    for (let step = 0; step < 3; step += 1) {
      expect(filledGold()).toHaveLength(1);
      expect(nextUp().contains(host.querySelector("button.frontier-primary"))).toBe(true);
      shown.push(nextUp().querySelector("p")!.textContent!);
      advance();
    }
    expect(shown).toEqual([
      "Realm is ready to be provisioned.",
      "Resources arrived at Realm.",
      "North is ready to be provisioned.",
    ]);
  });

  it("fills the Castle's Provision and Attention where no Next up is shown, as on the phone", () => {
    act(() =>
      root.render(
        <>
          <AttentionPill />
          <RealmUpgradeCompact />
        </>,
      ),
    );
    expect(filledGold()).toHaveLength(2);
  });
});
