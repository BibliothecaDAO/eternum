import type { SetupResult } from "@bibliothecadao/dojo";
import { Group, Raycaster, Vector2 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { WarpTravel, type WarpTravelLifecycleAdapter } from "./warp-travel";

export default class FastTravelScene extends WarpTravel {
  private readonly travelLabelGroup = new Group();

  constructor(
    dojoContext: SetupResult,
    raycaster: Raycaster,
    controls: MapControls,
    mouse: Vector2,
    sceneManager: SceneManager,
  ) {
    super(SceneName.FastTravel, controls, dojoContext, mouse, raycaster, sceneManager);
    this.travelLabelGroup.name = "FastTravelLabelsGroup";
  }

  protected getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    return {
      moveCameraToSceneLocation: () => this.moveCameraToURLLocation(),
      attachLabelGroupsToScene: () => this.attachWarpTravelLabelGroupsToScene([this.travelLabelGroup]),
      attachManagerLabels: () => undefined,
      registerStoreSubscriptions: () => undefined,
      setupCameraZoomHandler: () => undefined,
      refreshScene: async () => undefined,
      disposeStoreSubscriptions: () => undefined,
      detachLabelGroupsFromScene: () => this.detachWarpTravelLabelGroupsFromScene([this.travelLabelGroup]),
      detachManagerLabels: () => undefined,
    };
  }

  protected onHexagonMouseMove(): void {}

  protected onHexagonDoubleClick(): void {}

  protected onHexagonClick(): void {}

  protected onHexagonRightClick(): void {}

  public moveCameraToURLLocation(): void {
    const url = new URL(window.location.href);
    const col = Number(url.searchParams.get("col"));
    const row = Number(url.searchParams.get("row"));

    if (!Number.isFinite(col) || !Number.isFinite(row)) {
      return;
    }

    this.moveCameraToColRow(col, row, 0);
  }

  public onSwitchOff(): void {
    this.runWarpTravelSwitchOffLifecycle();
  }

  public hasActiveLabelAnimations(): boolean {
    return false;
  }
}
