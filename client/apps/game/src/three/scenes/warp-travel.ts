import type { SetupResult } from "@bibliothecadao/dojo";
import { Group, Raycaster, Vector2 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

import type { SceneManager } from "../scene-manager";
import { SceneName } from "../types";
import { HexagonScene } from "./hexagon-scene";
import {
  runWarpTravelSetupLifecycle,
  runWarpTravelSwitchOffLifecycle,
  type WarpTravelLifecycleAdapter,
  type WarpTravelLifecycleState,
} from "./warp-travel-lifecycle";

export { type WarpTravelLifecycleAdapter } from "./warp-travel-lifecycle";

export abstract class WarpTravel extends HexagonScene {
  protected isSwitchedOff = false;
  protected hasInitialized = false;
  private initialSetupPromise: Promise<void> | null = null;
  private lifecycleAdapter: WarpTravelLifecycleAdapter | null = null;

  constructor(
    sceneName: SceneName,
    controls: MapControls,
    dojo: SetupResult,
    mouse: Vector2,
    raycaster: Raycaster,
    sceneManager: SceneManager,
  ) {
    super(sceneName, controls, dojo, mouse, raycaster, sceneManager);
    this.bootstrapSceneOwnership();
  }

  public async setup(): Promise<void> {
    this.bootstrapSceneOwnership();
    const nextState = await runWarpTravelSetupLifecycle(
      this.getWarpTravelLifecycleState(),
      this.resolveWarpTravelLifecycleAdapter(),
    );
    this.applyWarpTravelLifecycleState(nextState);
  }

  protected runWarpTravelSwitchOffLifecycle(): void {
    const nextState = runWarpTravelSwitchOffLifecycle(
      this.getWarpTravelLifecycleState(),
      this.resolveWarpTravelLifecycleAdapter(),
    );
    this.applyWarpTravelLifecycleState(nextState);
  }

  protected attachWarpTravelLabelGroupsToScene(labelGroups: Group[]): void {
    labelGroups.forEach((group) => {
      if (!group.parent) {
        this.scene.add(group);
      }
    });
  }

  protected detachWarpTravelLabelGroupsFromScene(labelGroups: Group[]): void {
    labelGroups.forEach((group) => {
      this.scene.remove(group);
    });
  }

  private getWarpTravelLifecycleState(): WarpTravelLifecycleState {
    return {
      hasInitialized: this.hasInitialized,
      initialSetupPromise: this.initialSetupPromise,
      isSwitchedOff: this.isSwitchedOff,
    };
  }

  private applyWarpTravelLifecycleState(state: WarpTravelLifecycleState): void {
    this.hasInitialized = state.hasInitialized;
    this.initialSetupPromise = state.initialSetupPromise;
    this.isSwitchedOff = state.isSwitchedOff;
  }

  private resolveWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter {
    if (!this.lifecycleAdapter) {
      this.lifecycleAdapter = this.getWarpTravelLifecycleAdapter();
    }

    return this.lifecycleAdapter;
  }

  protected abstract getWarpTravelLifecycleAdapter(): WarpTravelLifecycleAdapter;
}
