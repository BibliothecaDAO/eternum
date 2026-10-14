import { SceneName } from "./types";
import { getContactShadowResources } from "./utils/contact-shadow";

interface CreateRendererControlBridgeRuntimeInput {
  createFolder: (name: string) => {
    add(
      target: object,
      property: string,
      ...args: unknown[]
    ): {
      name(label: string): { onChange?(handler: (value: any) => void): unknown };
      onChange?(handler: (value: any) => void): unknown;
    };
    close(): void;
  };
  getRenderer: () => { toneMapping: number; toneMappingExposure: number } | undefined;
  markLabelsDirty: () => void;
  moveCameraToColRow: (col: number, row: number, duration: number) => void;
  moveCameraToXYZ: (x: number, y: number, z: number, duration: number) => void;
  switchScene: (sceneName: SceneName) => void;
  updateContactShadowOpacity: (opacity: number) => void;
}

export interface RendererControlBridgeRuntime {
  handleInteractionChange(): void;
  markLabelsDirty(): void;
  setupGuiControls(isActive: () => boolean): Promise<void>;
}

export function createRendererControlBridgeRuntime(
  input: CreateRendererControlBridgeRuntimeInput,
): RendererControlBridgeRuntime {
  return {
    handleInteractionChange() {
      input.markLabelsDirty();
    },

    markLabelsDirty() {
      input.markLabelsDirty();
    },

    async setupGuiControls(isActive) {
      const { setupRendererDevGui } = await import("./renderer-dev-gui-runtime");
      if (!isActive()) return;
      const { material } = getContactShadowResources();

      setupRendererDevGui({
        contactShadowOpacity: material.opacity,
        createFolder: input.createFolder,
        moveCameraToColRow: input.moveCameraToColRow,
        moveCameraToXYZ: input.moveCameraToXYZ,
        renderer: input.getRenderer(),
        switchScene: input.switchScene,
        updateContactShadowOpacity: input.updateContactShadowOpacity,
      });
    },
  };
}
