// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { default: HexceptionScene } = await import("./hexception");

/** The realm view's click as the scene answers it, the store's own building selection behind it. */
const realmView = (ghost: object | null, pinnedPlot: { col: number; row: number } | null = null) =>
  Object.assign(Object.create(HexceptionScene.prototype), {
    state: useUIStore.getState(),
    buildingPreview: { getPreviewBuilding: () => ghost },
    pinnedPlot,
  }) as { onHexagonClick: (hex: { col: number; row: number } | null) => Promise<void> };

afterEach(() => useUIStore.getState().setSelectedBuildingHex(null));

// Owner, 27 October 2026: "empty ground lets go"; audit 10-27: the realm view's building card stayed.
it("lets go of the building or plot tapped before when the click lands on empty ground", async () => {
  useUIStore.getState().setSelectedBuildingHex({ structureId: 7, innerCol: 10, innerRow: 11 });
  await realmView(null).onHexagonClick(null);
  expect(useUIStore.getState().selectedBuildingHex).toBeNull();
});

it("keeps the plot while a building's ghost follows the pointer, waiting for its plot", async () => {
  const plot = { structureId: 7, innerCol: 10, innerRow: 11 };
  useUIStore.getState().setSelectedBuildingHex(plot);
  await realmView({ type: 1 }).onHexagonClick(null);
  expect(useUIStore.getState().selectedBuildingHex).toEqual(plot);
});

// Review 10-28: the build sheet pins its chosen building's ghost to the plot it opened on; that ghost is the sheet's,
// so empty ground still lets go of the plot, and the sheet with its ghost goes with it.
it("lets go of the plot when the click lands on empty ground while the build sheet's ghost stands pinned on it", async () => {
  useUIStore.getState().setSelectedBuildingHex({ structureId: 7, innerCol: 10, innerRow: 11 });
  await realmView({ type: 1 }, { col: 10, row: 11 }).onHexagonClick(null);
  expect(useUIStore.getState().selectedBuildingHex).toBeNull();
});
