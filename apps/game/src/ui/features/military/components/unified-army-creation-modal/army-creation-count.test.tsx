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
