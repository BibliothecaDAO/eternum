// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-world-spatial-tiles", () => ({ useWorldSpatialTiles: () => [] }));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useCurrentDefaultTick: () => 3,
  useCurrentArmiesTick: () => 3,
  useCurrentBlockTimestamp: () => 350,
}));
vi.mock("@/ui/features/world/containers/structure-sidebar", () => ({ StructureSidebar: () => null }));
vi.mock("@/ui/features/world/components/entities/hooks/use-structure-entity-detail", () => ({
  useStructureEntityDetail: () => ({ structure: null }),
}));
vi.mock("@/ui/features/military/components/unified-army-creation-modal/existing-armies-panel", () => ({
  ExistingArmiesPanel: () => <p>Existing armies of the realm</p>,
}));

import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup, NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { openArmyDeployment } from "@/ui/features/military/utils/open-army-deployment";
import type { TroopStack } from "@/ui/features/military/components/unified-army-creation-modal/types";
import { ResourcesIds, TroopTier, TroopType } from "@bibliothecadao/types";
import { MilitaryModal } from "./military-modal";

/** The viewport's width class as the HUD reads it: compact (a phone) or the desktop, and a way to cross `lg`. */
const viewport = (compact: boolean) => {
  const listeners = new Set<() => void>();
  const state = { compact };
  window.matchMedia = ((query: string) => ({
    matches: query.includes("orientation") ? false : state.compact,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    resize: (next: boolean) => {
      state.compact = next;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
};

const open = (prepare?: (store: NativeFactStore) => void) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = frontierDay();
  prepare?.(store);
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <MilitaryModal structureEntityId={7} />
      </GameProvider>,
    ),
  );
  const tab = (name: string) =>
    [...host.querySelectorAll<HTMLButtonElement>("[role=tab]")].find((each) => each.textContent === name);
  return {
    host,
    tab,
    press: (name: string) => act(() => tab(name)!.click()),
    count: (troop = "Knight T1") => host.querySelector<HTMLInputElement>(`input[aria-label="${troop}"]`),
    deploy: () => host.querySelector<HTMLButtonElement>(".ui-window__foot button[data-kind=primary]"),
    armies: () => host.textContent!.includes("Existing armies of the realm"),
    close: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
};

const typeInto = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

afterEach(() => setBlockTimestampSource(null));

it("on a phone shows Deploy only with its form, and keeps the draft across Existing armies", () => {
  viewport(true);
  const window = open();
  typeInto(window.count()!, "250");
  expect(window.deploy()).not.toBeNull();
  expect(window.armies()).toBe(false);

  window.press("Existing armies");
  expect(window.armies()).toBe(true);
  expect(window.count()).toBeNull();
  expect(window.deploy()).toBeNull();

  window.press("Deploy");
  expect(window.count()?.value).toBe("250");
  expect(window.deploy()).not.toBeNull();
  window.close();
});

it("on the desktop shows the form, its Deploy and the armies together, also after the window widens", () => {
  const screen = viewport(true);
  const window = open();
  typeInto(window.count()!, "250");
  window.press("Existing armies");
  expect(window.deploy()).toBeNull();

  screen.resize(false);
  expect(window.tab("Existing armies")).toBeUndefined();
  expect(window.armies()).toBe(true);
  expect(window.count()?.value).toBe("250");
  expect(window.deploy()).not.toBeNull();
  window.close();
});

/**
 * Military as Next up's Raise an army opens it, in a Blitz game: the realm's stacks as given, then the real deploy order
 * naming a stack. The fixture realm holds 420 Knights T1.
 */
const raiseOrder =
  (troops: TroopStack, crossbows = 0) =>
  (store: NativeFactStore) => {
    const game = store.require("GameRegistry", { game_id: 1 });
    store.applyFacts([{ model: "GameRegistry", key: "0x3", value: { ...game, preset_id: 2 } }] as never);
    if (crossbows > 0) {
      const recipe = store.require("ProductionRecipe", { game_id: 1, resource_type: ResourcesIds.Knight });
      store.applyFacts([
        {
          model: "ResourceBalance",
          key: "0xcbbc",
          value: {
            game_id: 1,
            entity_id: 7,
            resource_type: ResourcesIds.Crossbowman,
            balance: String(crossbows * 1e9),
          },
        },
        { model: "ProductionRecipe", key: "0xcbbd", value: { ...recipe, resource_type: ResourcesIds.Crossbowman } },
      ] as never);
    }
    openArmyDeployment({ structureId: 7, isExplorer: true, troops });
  };

it.each([
  ["a phone", true],
  ["the desktop", false],
])("opens on the count a raise order named, through the real order, on %s", (_, compact) => {
  viewport(compact);
  const window = open(raiseOrder({ type: TroopType.Knight, tier: TroopTier.T1, count: 300 }));
  expect(window.count()?.value).toBe("300");
  window.close();
});

it("opens on the stack the order named, not the first one held, when the realm holds two", () => {
  viewport(false);
  // 420 Knights T1 (the largest stack, the one Next up names) beside 100 Crossbowmen T1.
  const window = open(raiseOrder({ type: TroopType.Knight, tier: TroopTier.T1, count: 420 }, 100));
  expect(window.count("Knight T1")?.value).toBe("420");
  expect(window.count("Crossbowman T1")).toBeNull();
  window.close();
});
