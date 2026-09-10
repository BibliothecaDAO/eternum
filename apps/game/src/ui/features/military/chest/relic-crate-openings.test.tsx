import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listeners: [] as Array<(opening: unknown) => void>,
  toastSuccess: vi.fn(),
}));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: {} }) }));
vi.mock("@bibliothecadao/eternum", () => ({
  WorldUpdateListener: class {
    RelicChest = {
      onRelicChestOpened: (callback: (opening: unknown) => void) => {
        mocks.listeners.push(callback);
        return () => {};
      },
    };
  },
}));
vi.mock("@/ui/features/event-feed/notify", () => ({ toast: { success: mocks.toastSuccess } }));
import { useRelicCrateStore } from "@/hooks/store/use-relic-crate-store";
import { RelicCrateOpenings } from "./relic-crate-openings";

it("turns a crate opening into one feed row at the hex and keeps the relics for the tile panel", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<RelicCrateOpenings />));
  const opening = { explorerId: 7, hex: { x: 10, y: 12 }, relics: [101, 102, 103], timestamp: 5 };
  await act(async () => mocks.listeners[0]?.(opening));
  expect(mocks.toastSuccess).toHaveBeenCalledWith("Crate opened · 3 relics", { location: { x: 10, y: 12 } });
  expect(useRelicCrateStore.getState().openings["10,12"]).toEqual(opening);
  await act(async () => root.unmount());
});
