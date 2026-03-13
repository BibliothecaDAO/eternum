import type { Scene } from "three";

export interface SceneMutableRenderPassLike {
  mainScene?: unknown;
  scene?: unknown;
}

export function syncRenderPassScene(pass: SceneMutableRenderPassLike, scene: Scene): void {
  pass.scene = scene;

  if ("mainScene" in pass) {
    pass.mainScene = scene;
  }
}
