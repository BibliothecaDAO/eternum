import { CLICK_SLOP_PX } from "@/three/managers/map-click";

import { dragged, groundUnder, zoomed, type GroundPoint, type MapCamera } from "./map-camera";

interface ScreenPoint {
  x: number;
  y: number;
}

/** What the map's input moves and tells: the camera, the ground a finger tapped, and the ground a mouse is over. */
interface MapInputTarget {
  camera(): MapCamera;
  moveCamera(camera: MapCamera): void;
  tap(ground: GroundPoint): void;
  /** Null once the mouse has left the map. A finger hovers over nothing. */
  hover(ground: GroundPoint | null): void;
}

/** How much a wheel's notch zooms. */
const WHEEL_ZOOM = 0.0015;

/**
 * The map under a finger: one finger drags it, two pinch it nearer or further about the point between them, a wheel
 * zooms on the pointer, and a press that never moved is a tap on the ground under it. The camera never turns.
 */
export class MapInput {
  private readonly pressed = new Map<number, ScreenPoint>();
  /** Whether the press now down has moved far enough to be a drag, not a tap. */
  private moved = false;
  private pressedAt: ScreenPoint | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly target: MapInputTarget,
  ) {
    canvas.addEventListener("pointerdown", this.press);
    canvas.addEventListener("pointermove", this.move);
    canvas.addEventListener("pointerup", this.release);
    canvas.addEventListener("pointercancel", this.release);
    canvas.addEventListener("pointerleave", this.leave);
    canvas.addEventListener("wheel", this.wheel, { passive: false });
  }

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.press);
    this.canvas.removeEventListener("pointermove", this.move);
    this.canvas.removeEventListener("pointerup", this.release);
    this.canvas.removeEventListener("pointercancel", this.release);
    this.canvas.removeEventListener("pointerleave", this.leave);
    this.canvas.removeEventListener("wheel", this.wheel);
  }

  private viewport() {
    const box = this.canvas.getBoundingClientRect();
    return { width: box.width, height: box.height, left: box.left, top: box.top };
  }

  private onCanvas(event: PointerEvent | WheelEvent): ScreenPoint {
    const { left, top } = this.viewport();
    return { x: event.clientX - left, y: event.clientY - top };
  }

  private readonly press = (event: PointerEvent): void => {
    this.canvas.setPointerCapture(event.pointerId);
    const at = this.onCanvas(event);
    this.pressed.set(event.pointerId, at);
    this.moved = this.pressed.size > 1;
    this.pressedAt = at;
  };

  private readonly move = (event: PointerEvent): void => {
    const before = this.pressed.get(event.pointerId);
    const now = this.onCanvas(event);
    if (!before) {
      if (event.pointerType === "mouse")
        this.target.hover(groundUnder(this.target.camera(), this.viewport(), now.x, now.y));
      return;
    }
    if (this.pressed.size === 1) this.dragWith(before, now);
    else this.pinchWith(event.pointerId, now);
    this.pressed.set(event.pointerId, now);
  };

  private dragWith(before: ScreenPoint, now: ScreenPoint): void {
    const from = this.pressedAt ?? before;
    if (!this.moved && Math.hypot(now.x - from.x, now.y - from.y) < CLICK_SLOP_PX) return;
    // The first move past the slop drags from where the finger came down, so the ground does not jump.
    const start = this.moved ? before : from;
    this.moved = true;
    this.target.moveCamera(dragged(this.target.camera(), this.viewport(), start, now));
  }

  private pinchWith(pointerId: number, now: ScreenPoint): void {
    const other = [...this.pressed].find(([id]) => id !== pointerId)?.[1];
    const before = this.pressed.get(pointerId);
    if (!other || !before) return;
    const spread = (a: ScreenPoint, b: ScreenPoint) => Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
    const between = { x: (now.x + other.x) / 2, y: (now.y + other.y) / 2 };
    this.target.moveCamera(
      zoomed(this.target.camera(), this.viewport(), spread(before, other) / spread(now, other), between),
    );
  }

  private readonly release = (event: PointerEvent): void => {
    const at = this.pressed.get(event.pointerId);
    this.pressed.delete(event.pointerId);
    if (!at || this.moved || event.type === "pointercancel") return;
    this.target.tap(groundUnder(this.target.camera(), this.viewport(), at.x, at.y));
  };

  private readonly leave = (): void => this.target.hover(null);

  private readonly wheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.target.moveCamera(
      zoomed(this.target.camera(), this.viewport(), Math.exp(event.deltaY * WHEEL_ZOOM), this.onCanvas(event)),
    );
  };
}
