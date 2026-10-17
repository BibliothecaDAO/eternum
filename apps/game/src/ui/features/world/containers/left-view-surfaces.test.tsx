import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { LeftView } from "@/types";
import { dragHeader, panelOf, placementOf } from "@/ui/design-system/molecules/surface-panel-testing";

import { LeftViewSurfaces } from "./left-view-surfaces";

// A player in a game whose play is open; each workspace's own contents are not this test's business, only its frame.
vi.mock("@/utils/can-issue-orders", () => ({ canIssueOrders: () => true, refusedBeforePlay: () => false }));
vi.mock("@/ui/features/world/containers/construction-modal", async () => {
  const { SurfaceFrame } = await import("@/ui/design-system/molecules/popover");
  return {
    ConstructionModal: () => (
      <SurfaceFrame title="Build" onClose={() => {}}>
        Farm
      </SurfaceFrame>
    ),
  };
});
vi.mock("@/ui/features/world/containers/military-modal", async () => {
  const { SurfaceFrame } = await import("@/ui/design-system/molecules/popover");
  return {
    MilitaryModal: () => (
      <SurfaceFrame title="Military" onClose={() => {}}>
        Armies
      </SurfaceFrame>
    ),
  };
});
vi.mock("@/ui/features/world/containers/top-header/structure-groups", () => ({
  useStructureGroups: () => ({ structureGroups: {}, updateStructureGroup: () => {} }),
}));
vi.mock("@/config/game-modes/use-game-mode-config", () => ({ useGameModeConfig: () => ({}) }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRow: () => undefined }));

const CENTRED = ["translateX(-50%)", "274px"];

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("innerWidth", 1440);
  vi.stubGlobal("innerHeight", 900);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The workspace the player switches to, through the one writer every way into a workspace uses. */
const switchTo = (view: LeftView) => act(async () => useUIStore.getState().setLeftNavigationView(view));

it("opens each workspace the player switches to centred, not where the last one was dragged", async () => {
  const root = createRoot(document.createElement("div"));
  await switchTo(LeftView.ConstructionView);
  await act(async () => root.render(<LeftViewSurfaces />));
  await dragHeader("build", { x: 300, y: 200 });
  expect(placementOf("build")).toEqual(["translateX(-50%) translate(300px, 200px)", "274px"]);

  await switchTo(LeftView.MilitaryView);
  expect([panelOf("build"), placementOf("military")]).toEqual([null, CENTRED]);

  await switchTo(LeftView.None);
  await act(async () => root.unmount());
});
