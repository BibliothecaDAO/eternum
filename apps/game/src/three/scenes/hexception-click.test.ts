// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { configManager } = await import("@bibliothecadao/eternum");
const { default: HexceptionScene } = await import("./hexception");

/** The realm the board draws in these tests, whatever realm the session holds. */
const SHOWN_REALM = 8;

/**
 * The realm view's click as the scene answers it, the store's own building selection behind it, over a board of
 * open plots.
 */
const realmView = (ghost: object | null, pinnedPlot: { col: number; row: number } | null = null) =>
  Object.assign(Object.create(HexceptionScene.prototype), {
    state: useUIStore.getState(),
    buildingPreview: { getPreviewBuilding: () => ghost },
    pinnedPlot,
    shownRealmId: SHOWN_REALM,
    tileManager: { isHexOccupied: () => false },
  }) as { onHexagonClick: (hex: { col: number; row: number } | null) => Promise<void> };

const OPEN_PLOT = { col: 9, row: 12 };

afterEach(() => {
  useUIStore.getState().setSelectedBuildingHex(null);
  useUIStore.setState({ isSpectating: false, structureEntityId: 0 });
  vi.restoreAllMocks();
});

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

// Owner, 28 October 2026, visiting another realm: "the selected panel doesnt match the actual building (hover is
// right)". The hover reads the board's realm; a tap names that realm too, never the one the session holds since.
it("names the realm the board draws in the plot a player taps", async () => {
  vi.spyOn(configManager, "isGameOver").mockReturnValue(false);
  useUIStore.setState({ structureEntityId: 7, isSpectating: false });
  await realmView(null).onHexagonClick(OPEN_PLOT);
  expect(useUIStore.getState().selectedBuildingHex).toEqual({
    structureId: SHOWN_REALM,
    innerCol: OPEN_PLOT.col,
    innerRow: OPEN_PLOT.row,
  });
});

// Owner, 28 October 2026: "I shouldnt be able to click on the open tiles we're not building on their land".
it("treats an open plot as empty ground for a viewer, letting go of what was tapped", async () => {
  useUIStore.setState({ structureEntityId: SHOWN_REALM, isSpectating: true });
  useUIStore.getState().setSelectedBuildingHex({ structureId: SHOWN_REALM, innerCol: 10, innerRow: 11 });
  await realmView(null).onHexagonClick(OPEN_PLOT);
  expect(useUIStore.getState().selectedBuildingHex).toBeNull();
});
