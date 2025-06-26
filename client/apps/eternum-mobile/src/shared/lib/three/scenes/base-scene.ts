import { DojoResult } from "@bibliothecadao/react";
import * as THREE from "three";

export interface BaseScene {
  getScene(): THREE.Scene;
  update(camera: THREE.Camera): void;
  handleClick?(mouse: THREE.Vector2, camera: THREE.Camera): void;
  dispose(): void;
  getDojo?(): DojoResult;
}
