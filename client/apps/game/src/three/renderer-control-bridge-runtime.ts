import { setupRendererDevGui } from "./renderer-dev-gui-runtime";
import { SceneName } from "./types";
import { getContactShadowResources } from "./utils/contact-shadow";

interface CreateRendererControlBridgeRuntimeInput {
  changeCameraView: (view: 1 | 2 | 3) => void;
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
  fastTravelEnabled: () => boolean;
  getCurrentScene: () => SceneName | undefined;
  getRenderer: () => { toneMapping: number; toneMappingExposure: number } | undefined;
  markLabelsDirty: () => void;
  moveCameraToColRow: (col: number, row: number, duration: number) => void;
  moveCameraToXYZ: (x: number, y: number, z: number, duration: number) => void;
  requestFastTravelSceneRefresh: () => void;
  switchScene: (sceneName: SceneName) => void;
  updateContactShadowOpacity: (opacity: number) => void;
}

export interface RendererControlBridgeRuntime {
  handleInteractionChange(): void;
  markLabelsDirty(): void;
  setupGuiControls(): void;
}

export function createRendererControlBridgeRuntime(
  input: CreateRendererControlBridgeRuntimeInput,
): RendererControlBridgeRuntime {
  return {
    handleInteractionChange() {
      input.markLabelsDirty();
      if (input.getCurrentScene() === SceneName.FastTravel) {
        input.requestFastTravelSceneRefresh();
      }
    },

    markLabelsDirty() {
      input.markLabelsDirty();
    },

    setupGuiControls() {
      const { material } = getContactShadowResources();

      setupRendererDevGui({
        changeCameraView: input.changeCameraView,
        contactShadowOpacity: material.opacity,
        createFolder: input.createFolder,
        fastTravelEnabled: input.fastTravelEnabled(),
        moveCameraToColRow: input.moveCameraToColRow,
        moveCameraToXYZ: input.moveCameraToXYZ,
        renderer: input.getRenderer(),
        switchScene: input.switchScene,
        updateContactShadowOpacity: input.updateContactShadowOpacity,
      });
    },
  };
}
