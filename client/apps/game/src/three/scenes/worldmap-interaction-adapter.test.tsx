import { describe, expect, it, vi } from "vitest";
import { createWorldmapInteractionAdapter } from "./worldmap-interaction-adapter";

const navigateToStructureMock = vi.fn();
const openStructureContextMenuMock = vi.fn();
const playAudioMock = vi.fn();

vi.mock("../utils/navigation", () => ({
  navigateToStructure: (...args: unknown[]) => navigateToStructureMock(...args),
}));

vi.mock("./context-menu/structure-context-menu", () => ({
  openStructureContextMenu: (...args: unknown[]) => openStructureContextMenuMock(...args),
}));

vi.mock("@/audio/core/AudioManager", () => ({
  AudioManager: {
    getInstance: () => ({
      play: playAudioMock,
    }),
  },
}));

describe("WorldmapInteractionAdapter", () => {
  it("routes structure entry through store selection and navigation", () => {
    const setStructureEntityId = vi.fn();
    const adapter = createWorldmapInteractionAdapter({
      state: {
        setStructureEntityId,
      } as never,
    });

    adapter.enterStructure({
      hexCoords: { col: 12, row: 16 },
      structureId: 77,
      spectator: true,
      worldMapPosition: { col: 12, row: 16 },
    });

    expect(setStructureEntityId).toHaveBeenCalledWith(77, {
      spectator: true,
      worldMapPosition: { col: 12, row: 16 },
    });
    expect(navigateToStructureMock).toHaveBeenCalledWith(12, 16, "hex");
  });

  it("routes owned-hex selection through store updates and click audio", () => {
    const setSelectedHex = vi.fn();
    const selectedHexManager = { setPosition: vi.fn() };
    const adapter = createWorldmapInteractionAdapter({
      state: {
        selectedHex: { col: 0, row: 0 },
        setSelectedHex,
      } as never,
      selectedHexManager: selectedHexManager as never,
    });

    adapter.selectHex({
      contractHexPosition: { x: 4, y: 9 },
      isMine: true,
      position: { x: 10, z: 20 },
    });

    expect(selectedHexManager.setPosition).toHaveBeenCalledWith(10, 20);
    expect(setSelectedHex).toHaveBeenCalledWith({ col: 4, row: 9 });
    expect(playAudioMock).toHaveBeenCalledWith("ui.click");
  });

  it("routes owned-structure context menus through the adapter boundary", () => {
    const adapter = createWorldmapInteractionAdapter({
      state: {} as never,
      dojoComponents: "components" as never,
    });

    adapter.openOwnedStructureContextMenu({
      event: "evt" as never,
      hexCoords: { col: 3, row: 7 } as never,
      structure: { id: 88 } as never,
    });

    expect(openStructureContextMenuMock).toHaveBeenCalledWith({
      event: "evt",
      structure: { id: 88 },
      hexCoords: { col: 3, row: 7 },
      components: "components",
    });
  });

  it("routes army creation through the popup adapter", () => {
    const openArmyCreationPopup = vi.fn();
    const adapter = createWorldmapInteractionAdapter({
      state: {
        openArmyCreationPopup,
      } as never,
    });

    adapter.openArmyCreation({
      direction: 5,
      structureId: 42,
    });

    expect(openArmyCreationPopup).toHaveBeenCalledWith({
      structureId: 42,
      isExplorer: true,
      direction: 5,
    });
  });
});
