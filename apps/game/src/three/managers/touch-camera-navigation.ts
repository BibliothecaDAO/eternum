import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { MapControls } from "three/addons/controls/MapControls.js";
import type { TouchGesture } from "../utils/touch-gesture-recognizer";

type NavigationGesture = Extract<TouchGesture, { kind: "pan" | "pinch" }>;

export interface TouchNavigation {
  begin(): void;
  move(gesture: NavigationGesture, surface: HTMLElement): void;
  end(): void;
}

interface TouchCameraPolicy {
  begin(): void;
  zoom(distance: number): void;
  end(): void;
  changed(): void;
}

/** Direct manipulation of the ground plane, with scene-owned zoom distance and pitch. */
export class TouchCameraNavigation implements TouchNavigation {
  private savedDamping: boolean | null = null;
  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();
  private readonly ground = new Plane();

  constructor(
    private readonly controls: MapControls,
    private readonly policy: TouchCameraPolicy,
  ) {}

  begin(): void {
    if (this.savedDamping !== null) return;
    this.savedDamping = this.controls.enableDamping;
    // Drain desktop inertia without moving the map when the finger takes ownership.
    const position = this.controls.object.position.clone();
    const target = this.controls.target.clone();
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.object.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
    this.policy.begin();
  }

  move(gesture: NavigationGesture, surface: HTMLElement): void {
    if (!this.controls.enabled || this.savedDamping === null) return;
    const isPinch = gesture.kind === "pinch";
    if (!isPinch && !this.controls.enablePan) return;
    const fromX = isPinch ? gesture.previousCenterX : gesture.fromX;
    const fromY = isPinch ? gesture.previousCenterY : gesture.fromY;
    const toX = isPinch ? gesture.centerX : gesture.x;
    const toY = isPinch ? gesture.centerY : gesture.y;
    this.ground.setFromNormalAndCoplanarPoint(this.controls.object.up, this.controls.target);
    const anchor = this.groundPoint(fromX, fromY, surface);
    if (!anchor) return;

    if (isPinch) {
      const distance = this.controls.object.position.distanceTo(this.controls.target) / gesture.scale;
      if (!Number.isFinite(distance)) return;
      this.policy.zoom(Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, distance)));
    }
    // Reproject after zoom and pitch change; translating both preserves the camera's orientation.
    const nextAnchor = this.groundPoint(toX, toY, surface);
    if (nextAnchor && this.controls.enablePan) {
      const translation = anchor.sub(nextAnchor);
      this.controls.target.add(translation);
      this.controls.object.position.add(translation);
    }
    this.policy.changed();
  }

  end(): void {
    if (this.savedDamping === null) return;
    this.controls.enableDamping = this.savedDamping;
    this.savedDamping = null;
    this.policy.end();
  }

  private groundPoint(x: number, y: number, surface: HTMLElement): Vector3 | null {
    const bounds = surface.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;
    this.pointer.set(((x - bounds.left) / bounds.width) * 2 - 1, -((y - bounds.top) / bounds.height) * 2 + 1);
    this.controls.object.lookAt(this.controls.target);
    this.controls.object.updateMatrixWorld();
    this.raycaster.setFromCamera(this.pointer, this.controls.object);
    return this.raycaster.ray.intersectPlane(this.ground, new Vector3());
  }
}
