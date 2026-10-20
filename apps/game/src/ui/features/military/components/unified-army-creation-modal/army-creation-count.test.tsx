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

import { GameProvider } from "@/hooks/context/game-context";
import { HudWindow } from "@/ui/design-system/kit/hud-elements";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { UnifiedArmyCreationBody } from "./unified-army-creation-modal";

afterEach(() => setBlockTimestampSource(null));

/** Types into a mounted field as a player does, the field's own input event included. */
const typeInto = (input: HTMLInputElement, text: string) =>
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

it("keeps the troop count the player typed in the Military window: its sign, its whole part, at most what is on hand", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = frontierDay();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <UnifiedArmyCreationBody structureId={7} />
      </GameProvider>,
    ),
  );
  const count = () => host.querySelector<HTMLInputElement>('input[aria-label="Knight T1"]')!;
  // The fixture realm holds 420 knights, under a 1,500 cap.
  for (const [text, shown] of [
    ["-500", "0"],
    ["1.5", "1"],
    ["1,200", "420"],
    ["250", "250"],
  ] as const) {
    typeInto(count(), text);
    expect(count().value, text).toBe(shown);
  }
  act(() => root.unmount());
  host.remove();
});

it("says in the Military window's foot the stamina a field army starts on, from the game's rules (live-qa-night-2 B-2)", () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store } = frontierDay();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <HudWindow title="Military" onClose={() => undefined}>
          <UnifiedArmyCreationBody structureId={7} />
        </HudWindow>
      </GameProvider>,
    ),
  );
  // The fixture's knights start at 150 under a 150 maximum: full.
  expect(host.querySelector(".ui-window__foot")?.textContent).toContain("The new army starts full: 150/150 stamina");
  act(() => root.unmount());
  host.remove();
});
