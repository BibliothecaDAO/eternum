/**
 * Pure touch gesture recognizer. Feed it raw touch pointer samples and it emits taps,
 * long presses and navigation steps. One instance owns the entire touch session,
 * so a drag or a pinch cannot also become a gameplay press.
 */

const TAP_SLOP_PX = 10;
const LONG_PRESS_MS = 500;

export interface TouchPointerSample {
  kind: "down" | "move" | "up" | "cancel";
  pointerId: number;
  x: number;
  y: number;
  time: number;
}

export const TOUCH_POINTER_EVENT_TYPES = [
  "pointerdown",
  "pointermove",
  "pointerup",
  "pointercancel",
  "lostpointercapture",
] as const;
type TouchPointerEventType = (typeof TOUCH_POINTER_EVENT_TYPES)[number];

const SAMPLE_KIND_BY_EVENT_TYPE: Record<TouchPointerEventType, TouchPointerSample["kind"]> = {
  pointerdown: "down",
  pointermove: "move",
  pointerup: "up",
  pointercancel: "cancel",
  lostpointercapture: "cancel",
};

/** Null for non-touch pointers, so callers can leave mouse and pen input on their existing paths. */
export function toTouchPointerSample(event: PointerEvent): TouchPointerSample | null {
  if (event.pointerType !== "touch") {
    return null;
  }
  const kind = SAMPLE_KIND_BY_EVENT_TYPE[event.type as TouchPointerEventType];
  if (!kind) {
    return null;
  }
  return { kind, pointerId: event.pointerId, x: event.clientX, y: event.clientY, time: event.timeStamp };
}

export type TouchGesture =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "tap"; x: number; y: number }
  | { kind: "long-press"; x: number; y: number }
  | { kind: "pan"; fromX: number; fromY: number; x: number; y: number }
  | {
      kind: "pinch";
      scale: number;
      centerX: number;
      centerY: number;
      previousCenterX: number;
      previousCenterY: number;
    };

/** Schedules `fn` after `ms` and returns a cancel function; injectable so tests stay deterministic. */
export type ScheduleTimer = (fn: () => void, ms: number) => () => void;

interface PointerPosition {
  x: number;
  y: number;
}

interface PressState {
  pointerId: number;
  start: PointerPosition;
  movedPastSlop: boolean;
  longPressFired: boolean;
}

const scheduleWithTimeout: ScheduleTimer = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

export class TouchGestureRecognizer {
  private readonly pointers = new Map<number, PointerPosition>();
  private press: PressState | null = null;
  private cancelLongPressTimer: (() => void) | null = null;

  constructor(
    private readonly emit: (gesture: TouchGesture) => void,
    private readonly schedule: ScheduleTimer = scheduleWithTimeout,
  ) {}

  feed(sample: TouchPointerSample): void {
    switch (sample.kind) {
      case "down":
        this.handleDown(sample);
        return;
      case "move":
        this.handleMove(sample);
        return;
      case "up":
        this.handleUp(sample);
        return;
      case "cancel":
        this.handleCancel(sample);
        return;
    }
  }

  reset(): void {
    const hadPointers = this.pointers.size > 0;
    this.clearPress();
    this.pointers.clear();
    if (hadPointers) this.emit({ kind: "end" });
  }

  private handleDown(sample: TouchPointerSample): void {
    this.pointers.set(sample.pointerId, { x: sample.x, y: sample.y });

    if (this.pointers.size === 1) {
      this.emit({ kind: "start" });
      this.beginPress(sample);
      return;
    }

    this.clearPress();
  }

  private handleMove(sample: TouchPointerSample): void {
    const pointer = this.pointers.get(sample.pointerId);
    if (!pointer) {
      return;
    }
    const previous = { ...pointer };
    const previousCenter = this.pointers.size === 2 ? this.pinchCenter() : null;
    const previousDistance = this.pointers.size === 2 ? this.currentPinchDistance() : 0;
    pointer.x = sample.x;
    pointer.y = sample.y;

    if (this.pointers.size === 2 && previousCenter) {
      this.emitPinchStep(previousCenter, previousDistance);
      return;
    }
    if (this.pointers.size !== 1 || this.press?.longPressFired) return;

    if (this.press?.pointerId === sample.pointerId && !this.press.movedPastSlop) {
      if (distanceBetween(this.press.start, sample) > TAP_SLOP_PX) {
        this.press.movedPastSlop = true;
        this.stopLongPressTimer();
      }
    }
    if (!this.press || this.press.movedPastSlop) {
      this.emit({ kind: "pan", fromX: previous.x, fromY: previous.y, x: sample.x, y: sample.y });
    }
  }

  private handleUp(sample: TouchPointerSample): void {
    if (!this.pointers.has(sample.pointerId)) return;
    this.pointers.delete(sample.pointerId);

    if (this.press?.pointerId === sample.pointerId) {
      const isTap =
        !this.press.movedPastSlop &&
        !this.press.longPressFired &&
        distanceBetween(this.press.start, sample) <= TAP_SLOP_PX;
      this.clearPress();
      if (isTap) {
        this.emit({ kind: "tap", x: sample.x, y: sample.y });
      }
    }

    if (this.pointers.size === 0) this.emit({ kind: "end" });
  }

  private handleCancel(sample: TouchPointerSample): void {
    if (this.pointers.has(sample.pointerId)) this.reset();
  }

  private beginPress(sample: TouchPointerSample): void {
    this.clearPress();
    const press: PressState = {
      pointerId: sample.pointerId,
      start: { x: sample.x, y: sample.y },
      movedPastSlop: false,
      longPressFired: false,
    };
    this.press = press;
    this.cancelLongPressTimer = this.schedule(() => {
      this.cancelLongPressTimer = null;
      if (this.press !== press || press.movedPastSlop) {
        return;
      }
      press.longPressFired = true;
      this.emit({ kind: "long-press", x: press.start.x, y: press.start.y });
    }, LONG_PRESS_MS);
  }

  private emitPinchStep(previousCenter: PointerPosition, previousDistance: number): void {
    const distance = this.currentPinchDistance();
    if (previousDistance <= 0 || distance <= 0) {
      return;
    }
    const [first, second] = this.pinchPointers();
    this.emit({
      kind: "pinch",
      scale: distance / previousDistance,
      centerX: (first.x + second.x) / 2,
      centerY: (first.y + second.y) / 2,
      previousCenterX: previousCenter.x,
      previousCenterY: previousCenter.y,
    });
  }

  private clearPress(): void {
    this.stopLongPressTimer();
    this.press = null;
  }

  private stopLongPressTimer(): void {
    this.cancelLongPressTimer?.();
    this.cancelLongPressTimer = null;
  }

  private pinchPointers(): [PointerPosition, PointerPosition] {
    const iterator = this.pointers.values();
    return [iterator.next().value as PointerPosition, iterator.next().value as PointerPosition];
  }

  private currentPinchDistance(): number {
    const [first, second] = this.pinchPointers();
    return distanceBetween(first, second);
  }

  private pinchCenter(): PointerPosition {
    const [first, second] = this.pinchPointers();
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }
}

function distanceBetween(a: PointerPosition, b: PointerPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
