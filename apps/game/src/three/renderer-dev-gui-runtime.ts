import { ACESFilmicToneMapping, CineonToneMapping, LinearToneMapping, NoToneMapping, ReinhardToneMapping } from "three";
import { SceneName } from "./types";

type GuiFolderLike = {
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

interface SetupRendererDevGuiInput {
  changeCameraView: (view: 1 | 2 | 3) => void;
  contactShadowOpacity: number;
  createFolder: (name: string) => GuiFolderLike;
  fastTravelEnabled: boolean;
  moveCameraToColRow: (col: number, row: number, duration: number) => void;
  moveCameraToXYZ: (x: number, y: number, z: number, duration: number) => void;
  renderer: { toneMapping: number; toneMappingExposure: number } | undefined;
  switchScene: (sceneName: SceneName) => void;
  updateContactShadowOpacity: (opacity: number) => void;
}

export function setupRendererDevGui(input: SetupRendererDevGuiInput): void {
  setupSceneSwitchingFolder(input);
  setupCameraMovementFolder(input);
  setupRendererFolder(input);
  setupContactShadowFolder(input);
}

function setupSceneSwitchingFolder(input: SetupRendererDevGuiInput): void {
  const folder = input.createFolder("Switch scene");
  const params = { scene: SceneName.WorldMap };
  const sceneOptions = input.fastTravelEnabled
    ? [SceneName.WorldMap, SceneName.Hexception, SceneName.FastTravel]
    : [SceneName.WorldMap, SceneName.Hexception];

  folder.add(params, "scene", sceneOptions).name("Scene");
  folder.add({ switchScene: () => input.switchScene(params.scene) }, "switchScene");
  folder.close();
}

function setupCameraMovementFolder(input: SetupRendererDevGuiInput): void {
  const folder = input.createFolder("Move Camera");
  const moveCameraParams = { col: 0, row: 0, x: 0, y: 0, z: 0 };

  folder.add(moveCameraParams, "col").name("Column");
  folder.add(moveCameraParams, "row").name("Row");
  folder.add(moveCameraParams, "x").name("X");
  folder.add(moveCameraParams, "y").name("Y");
  folder.add(moveCameraParams, "z").name("Z");
  folder
    .add({ move: () => input.moveCameraToColRow(moveCameraParams.col, moveCameraParams.row, 0) }, "move")
    .name("Move Camera");
  folder.add(
    { move: () => input.moveCameraToXYZ(moveCameraParams.x, moveCameraParams.y, moveCameraParams.z, 0) },
    "move",
  );

  const cameraViewParams = { view: 2 };
  folder.add(cameraViewParams, "view", [1, 2, 3]).name("Camera View");
  folder
    .add({ changeView: () => input.changeCameraView(cameraViewParams.view as 1 | 2 | 3) }, "changeView")
    .name("Change View");
  folder.close();
}

function setupRendererFolder(input: SetupRendererDevGuiInput): void {
  if (!input.renderer) {
    return;
  }

  const folder = input.createFolder("Renderer");
  folder
    .add(input.renderer, "toneMapping", {
      "No Tone Mapping": NoToneMapping,
      "Linear Tone Mapping": LinearToneMapping,
      "Reinhard Tone Mapping": ReinhardToneMapping,
      "Cineon Tone Mapping": CineonToneMapping,
      "ACESFilmic Tone Mapping": ACESFilmicToneMapping,
    })
    .name("Tone Mapping");
  folder.add(input.renderer, "toneMappingExposure", 0, 2).name("Tone Mapping Exposure");
  folder.close();
}

function setupContactShadowFolder(input: SetupRendererDevGuiInput): void {
  const folder = input.createFolder("Contact Shadows");
  const params = { opacity: input.contactShadowOpacity };
  folder
    .add(params, "opacity", 0, 0.6, 0.01)
    .name("Opacity")
    .onChange?.((value: number) => {
      input.updateContactShadowOpacity(value);
    });
  folder.close();
}
