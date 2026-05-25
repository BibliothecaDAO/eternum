import { describe, expect, it, vi } from "vitest";
import { SceneName } from "./types";

const { setupRendererDevGui } = await import("./renderer-dev-gui-runtime");

type OnChangeHandler = (value: any) => void;

function createFolderDouble() {
  const records: Array<{
    args: unknown[];
    object: Record<string, unknown>;
    onChangeHandlers: OnChangeHandler[];
    property: string;
  }> = [];

  return {
    folder: {
      add(object: Record<string, unknown>, property: string, ...args: unknown[]) {
        const record = {
          args,
          object,
          onChangeHandlers: [] as OnChangeHandler[],
          property,
        };
        records.push(record);
        return {
          name() {
            return this;
          },
          onChange(handler: OnChangeHandler) {
            record.onChangeHandlers.push(handler);
            return this;
          },
        };
      },
      close: vi.fn(),
    },
    records,
  };
}

describe("setupRendererDevGui", () => {
  it("gates the scene switcher options by fast-travel availability", () => {
    const createdFolders: Record<string, ReturnType<typeof createFolderDouble>> = {};

    setupRendererDevGui({
      changeCameraView: vi.fn(),
      contactShadowOpacity: 0.2,
      createFolder: (name) => {
        const folder = createFolderDouble();
        createdFolders[name] = folder;
        return folder.folder as never;
      },
      fastTravelEnabled: false,
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      renderer: undefined,
      switchScene: vi.fn(),
      updateContactShadowOpacity: vi.fn(),
    });

    const switchRecord = createdFolders["Switch scene"]?.records[0];

    expect(switchRecord?.args[0]).toEqual([SceneName.WorldMap, SceneName.Hexception]);
  });

  it("wires scene switch, camera move, and camera view actions through the provided callbacks", () => {
    const createdFolders: Record<string, ReturnType<typeof createFolderDouble>> = {};
    const switchScene = vi.fn();
    const moveCameraToColRow = vi.fn();
    const moveCameraToXYZ = vi.fn();
    const changeCameraView = vi.fn();

    setupRendererDevGui({
      changeCameraView,
      contactShadowOpacity: 0.2,
      createFolder: (name) => {
        const folder = createFolderDouble();
        createdFolders[name] = folder;
        return folder.folder as never;
      },
      fastTravelEnabled: true,
      moveCameraToColRow,
      moveCameraToXYZ,
      renderer: undefined,
      switchScene,
      updateContactShadowOpacity: vi.fn(),
    });

    const sceneFolderRecords = createdFolders["Switch scene"]?.records ?? [];
    const cameraFolderRecords = createdFolders["Move Camera"]?.records ?? [];
    const sceneParams = sceneFolderRecords[0]?.object;
    const switchAction = sceneFolderRecords[1]?.object.switchScene as (() => void) | undefined;
    sceneParams!.scene = SceneName.FastTravel;
    switchAction?.();

    const colRowAction = cameraFolderRecords[5]?.object.move as (() => void) | undefined;
    const xyzAction = cameraFolderRecords[6]?.object.move as (() => void) | undefined;
    const viewParams = cameraFolderRecords[7]?.object;
    const viewAction = cameraFolderRecords[8]?.object.changeView as (() => void) | undefined;
    viewParams!.view = 3;
    colRowAction?.();
    xyzAction?.();
    viewAction?.();

    expect(switchScene).toHaveBeenCalledWith(SceneName.FastTravel);
    expect(moveCameraToColRow).toHaveBeenCalledWith(0, 0, 0);
    expect(moveCameraToXYZ).toHaveBeenCalledWith(0, 0, 0, 0);
    expect(changeCameraView).toHaveBeenCalledWith(3);
  });

  it("skips renderer controls when no renderer is available", () => {
    const createdFolders: string[] = [];

    setupRendererDevGui({
      changeCameraView: vi.fn(),
      contactShadowOpacity: 0.2,
      createFolder: (name) => {
        createdFolders.push(name);
        return createFolderDouble().folder as never;
      },
      fastTravelEnabled: true,
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      renderer: undefined,
      switchScene: vi.fn(),
      updateContactShadowOpacity: vi.fn(),
    });

    expect(createdFolders).not.toContain("Renderer");
    expect(createdFolders).toContain("Contact Shadows");
  });

  it("wires renderer settings and contact shadow opacity controls", () => {
    const createdFolders: Record<string, ReturnType<typeof createFolderDouble>> = {};
    const renderer = { toneMapping: 1, toneMappingExposure: 0.8 };
    const updateContactShadowOpacity = vi.fn();

    setupRendererDevGui({
      changeCameraView: vi.fn(),
      contactShadowOpacity: 0.24,
      createFolder: (name) => {
        const folder = createFolderDouble();
        createdFolders[name] = folder;
        return folder.folder as never;
      },
      fastTravelEnabled: true,
      moveCameraToColRow: vi.fn(),
      moveCameraToXYZ: vi.fn(),
      renderer,
      switchScene: vi.fn(),
      updateContactShadowOpacity,
    });

    const rendererFolderRecords = createdFolders["Renderer"]?.records ?? [];
    const contactShadowRecord = createdFolders["Contact Shadows"]?.records[0];

    expect(rendererFolderRecords[0]?.object).toBe(renderer);
    expect(rendererFolderRecords[1]?.object).toBe(renderer);

    contactShadowRecord?.onChangeHandlers[0]?.(0.42);
    expect(updateContactShadowOpacity).toHaveBeenCalledWith(0.42);
  });
});
