// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

/** The transfer forms, down to the moment their transfer is sent. */
vi.mock("./transfer-troops-container", () => ({
  TransferTroopsContainer: ({ onTransferComplete }: { onTransferComplete: () => void }) => (
    <button onClick={onTransferComplete}>Sent</button>
  ),
}));
vi.mock("./transfer-resources-container", () => ({ TransferResourcesContainer: () => null }));
vi.mock("@/utils/can-issue-orders", async (original) => ({
  ...(await original<typeof import("@/utils/can-issue-orders")>()),
  canIssueOrders: () => true,
  refusedBeforePlay: () => false,
}));

import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { configManager } from "@bibliothecadao/eternum";
import { ActorType } from "@bibliothecadao/types";
import { HelpContainer } from "./help-container";

const ARMY = 201;

/** The screen's width: a desktop at and above the HUD's desktop width, a phone below it. */
const screen = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

afterEach(() => {
  useUIStore.getState().selectOnMap(null);
  usePopoverStore.getState().close();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// Owner, 27 October 2026: "yes" to the army staying selected after a transfer on a phone, as on a desktop.
it.each([
  ["a phone", false],
  ["a desktop", true],
])("on %s, a sent transfer closes its window and keeps the army selected", (_, desktop) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  screen(desktop);
  vi.spyOn(configManager, "helpTransfers").mockReturnValue(["troops"]);
  useUIStore.getState().selectOnMap({ kind: "army", entityId: ARMY, tile: null });
  usePopoverStore
    .getState()
    .openSurface({ id: "help", anchor: { left: 0, right: 0, top: 0, bottom: 0 }, content: null });
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <HelpContainer
        selected={{ type: ActorType.Explorer, id: ARMY, hex: { x: 41, y: 12 } }}
        target={{ type: ActorType.Explorer, id: 202, hex: { x: 42, y: 12 } }}
      />,
    ),
  );

  const sent = [...host.querySelectorAll("button")].find((button) => button.textContent === "Sent")!;
  act(() => sent.click());

  expect(usePopoverStore.getState().surface).toBeNull();
  expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  act(() => root.unmount());
});
