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
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
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

const open = () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = frontierDay();
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
    count: () => host.querySelector<HTMLInputElement>('input[aria-label="Knight T1"]'),
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
