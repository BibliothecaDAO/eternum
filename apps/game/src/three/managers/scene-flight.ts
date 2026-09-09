import { Vector3 } from "three";
import type { HexagonScene } from "../scenes/hexagon-scene";
import { SceneName } from "../types";

export function canFlyBetweenScenes(from: SceneName | undefined, to: SceneName, reducedMotion: boolean): boolean {
  return (
    !reducedMotion &&
    ((from === SceneName.WorldMap && to === SceneName.Hexception) ||
      (from === SceneName.Hexception && to === SceneName.WorldMap))
  );
}

/** The outgoing frame stays visible while the incoming scene prepares its GPU resources. */
export class SceneFlight {
  private frame: HTMLCanvasElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private capturePending = false;
  private revealPending = false;
  private resolveFlight: ((completed: boolean) => void) | null = null;
  private destroyed = false;
  private cancelAnimation: (() => void) | undefined;
  private readonly originalPosition: Vector3;
  private readonly originalTarget: Vector3;

  constructor(
    private readonly outgoing: HexagonScene,
    private readonly destination: SceneName,
  ) {
    this.originalPosition = outgoing.getCamera().position.clone();
    this.originalTarget = outgoing.getCameraTargetPosition();
  }

  flyOut(): Promise<boolean> {
    const enteringRealm = this.destination === SceneName.Hexception;
    const location = this.outgoing.getLocationCoordinates();
    const target = enteringRealm
      ? new Vector3(location.x, this.originalTarget.y, location.z)
      : this.originalTarget.clone();
    const offset = this.originalPosition
      .clone()
      .sub(this.originalTarget)
      .multiplyScalar(enteringRealm ? 0.45 : 1.25);
    this.cancelAnimation = this.outgoing.cameraAnimate(target.clone().add(offset), target, 0.45);
    return new Promise((resolve) => {
      this.resolveFlight = resolve;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.capturePending = true;
      }, 450);
    });
  }

  /** The captured frame stays until the incoming scene is presentable, then fades on its next rendered frame. */
  reveal(incoming: HexagonScene): void {
    if (this.destroyed) return;
    void incoming.whenPresentable().then(() => {
      if (this.destroyed) return;
      const target = incoming.getCameraTargetPosition();
      const settled = incoming.getCamera().position.clone();
      const factor = this.destination === SceneName.Hexception ? 1.15 : 0.85;
      incoming.getCamera().position.copy(target).add(settled.clone().sub(target).multiplyScalar(factor));
      incoming.cameraAnimate(settled, target, 0.3);
      this.revealPending = true;
    });
  }

  /** Called synchronously after rendering, while the non-preserved drawing buffer is still valid. */
  onFrameRendered(source: HTMLCanvasElement, sceneName: SceneName): void {
    if (this.destroyed) return;
    if (this.capturePending && sceneName !== this.destination) {
      this.capturePending = false;
      this.captureOutgoingFrame(source);
      this.restoreOutgoingCamera();
      this.resolveFlight?.(true);
      this.resolveFlight = null;
    }
    if (this.revealPending && sceneName === this.destination) {
      this.revealPending = false;
      if (!this.frame) return;
      this.frame.style.transition = "opacity 150ms ease-out";
      this.frame.style.opacity = "0";
      this.timer = setTimeout(() => this.removeFrame(), 150);
    }
  }

  destroy(): void {
    this.destroyed = true;
    if (this.timer !== null) clearTimeout(this.timer);
    this.capturePending = false;
    this.revealPending = false;
    this.cancelAnimation?.();
    this.cancelAnimation = undefined;
    this.resolveFlight?.(false);
    this.resolveFlight = null;
    this.removeFrame();
  }

  private restoreOutgoingCamera(): void {
    this.cancelAnimation?.();
    this.cancelAnimation = undefined;
    const { x, y, z } = this.originalTarget;
    this.outgoing.moveCameraToXYZ(x, y, z, 0);
    this.outgoing.getCamera().position.copy(this.originalPosition);
  }

  /**
   * The copy stays on the GPU: `createImageBitmap` snapshots the drawing buffer at call time and a bitmap
   * renderer presents it, so the flight never pays the ReadPixels stall a 2D `drawImage` of a WebGL canvas costs.
   */
  private captureOutgoingFrame(source: HTMLCanvasElement): void {
    const frame = document.createElement("canvas");
    frame.width = source.width;
    frame.height = source.height;
    const context = frame.getContext("bitmaprenderer");
    if (!context) return;
    void createImageBitmap(source).then((bitmap) => {
      if (this.frame === frame) context.transferFromImageBitmap(bitmap);
      else bitmap.close();
    });
    const rect = source.getBoundingClientRect();
    Object.assign(frame.style, {
      position: "fixed",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      pointerEvents: "none",
      zIndex: "9",
    });
    frame.setAttribute("aria-hidden", "true");
    frame.dataset.sceneTransition = "frame";
    document.body.appendChild(frame);
    this.frame = frame;
  }

  private removeFrame(): void {
    this.frame?.remove();
    this.frame = null;
    this.timer = null;
  }
}
