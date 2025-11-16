import { Box3, Frustum, Matrix4, PerspectiveCamera, Sphere, Vector3 } from "three";
import type { MapControls } from "three/examples/jsm/controls/MapControls.js";

type FrustumListener = () => void;

/**
 * FrustumManager keeps a cached THREE.Frustum that updates whenever map controls move.
 * Consumers can query visibility helpers without recalculating the frustum themselves.
 */
export class FrustumManager {
  private frustum = new Frustum();
  private matrix = new Matrix4();
  private listeners: Set<FrustumListener> = new Set();
  private controls: MapControls;
  private camera: PerspectiveCamera;
  private isDirty = true;
  private disposeControlsListener: (() => void) | null = null;

  constructor(camera: PerspectiveCamera, controls: MapControls) {
    this.camera = camera;
    this.controls = controls;
    const controlsListener = () => {
      this.isDirty = true;
      this.updateFrustum();
    };

    this.controls.addEventListener("change", controlsListener);
    this.disposeControlsListener = () => {
      this.controls.removeEventListener("change", controlsListener);
    };

    this.updateFrustum();
  }

  /**
   * Ensure cached frustum matches the latest camera matrices.
   */
  private updateFrustum() {
    if (!this.isDirty) {
      return;
    }

    this.camera.updateMatrixWorld(true);
    this.matrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.matrix);
    this.isDirty = false;
    this.notifyListeners();
  }

  /**
   * Manual refresh entry point for situations where controls don't emit a change event.
   */
  public forceUpdate(): void {
    this.isDirty = true;
    this.updateFrustum();
  }

  public isPointVisible(point: Vector3): boolean {
    this.updateFrustum();
    return this.frustum.containsPoint(point);
  }

  public isBoxVisible(box: Box3 | null | undefined): boolean {
    if (!box) {
      return true;
    }
    this.updateFrustum();
    return this.frustum.intersectsBox(box);
  }

  public isSphereVisible(sphere: Sphere | null | undefined): boolean {
    if (!sphere) {
      return true;
    }
    this.updateFrustum();
    return this.frustum.intersectsSphere(sphere);
  }

  /**
   * Allow consumers to react to frustum updates (e.g. toggle overlay visibility).
   * Returns an unsubscribe callback.
   */
  public onChange(listener: FrustumListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  public dispose(): void {
    if (this.disposeControlsListener) {
      this.disposeControlsListener();
      this.disposeControlsListener = null;
    }
    this.listeners.clear();
  }
}
