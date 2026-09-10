/**
 * Pure touch gesture recognizer. Feed it raw touch pointer samples and it emits taps,
 * double taps, long presses, and pinch scale steps. It never touches the DOM, so the
 * scene input manager and the worldmap pinch handler can each own an instance.
 */

const TAP_SLOP_PX = 10;
const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP_PX = 24;

export interface TouchPointerSample {
  kind: "down" | "move" | "up" | "cancel";
  pointerId: number;
  x: number;
  y: number;
  time: number;
}

export const TOUCH_POINTER_EVENT_TYPES = ["pointerdown", "pointermove", "pointerup", "pointercancel"] as const;
type TouchPointerEventType = (typeof TOUCH_POINTER_EVENT_TYPES)[number];

const SAMPLE_KIND_BY_EVENT_TYPE: Record<TouchPointerEventType, TouchPointerSample["kind"]> = {
  pointerdown: "down",
  pointermove: "move",
  pointerup: "up",
  pointercancel: "cancel",
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
  | { kind: "tap"; x: number; y: number }
  | { kind: "double-tap"; x: number; y: number }
  | { kind: "long-press"; x: number; y: number }
  | { kind: "pinch"; scale: number; centerX: number; centerY: number };

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

interface TapRecord extends PointerPosition {
  time: number;
}

const scheduleWithTimeout: ScheduleTimer = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return () => clearTimeout(timer);
};

export class TouchGestureRecognizer {
  private readonly pointers = new Map<number, PointerPosition>();
  private press: PressState | null = null;
  private cancelLongPressTimer: (() => void) | null = null;
  private pinchActive = false;
  private previousPinchDistance: number | null = null;
  private lastTap: TapRecord | null = null;

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
    this.clearPress();
    this.pointers.clear();
    this.pinchActive = false;
    this.previousPinchDistance = null;
    this.lastTap = null;
  }

  private handleDown(sample: TouchPointerSample): void {
    this.pointers.set(sample.pointerId, { x: sample.x, y: sample.y });

    if (this.pointers.size === 1) {
      this.beginPress(sample);
      return;
    }

    if (this.pointers.size === 2) {
      this.beginPinch();
    }
  }

  private handleMove(sample: TouchPointerSample): void {
    const pointer = this.pointers.get(sample.pointerId);
    if (!pointer) {
      return;
    }
    pointer.x = sample.x;
    pointer.y = sample.y;

    if (this.pinchActive) {
      this.emitPinchStep();
      return;
    }

    if (this.press?.pointerId === sample.pointerId && !this.press.movedPastSlop) {
      if (distanceBetween(this.press.start, sample) > TAP_SLOP_PX) {
        this.press.movedPastSlop = true;
        this.stopLongPressTimer();
      }
    }
  }

  private handleUp(sample: TouchPointerSample): void {
    this.pointers.delete(sample.pointerId);

    if (this.press?.pointerId === sample.pointerId) {
      const isTap = !this.press.movedPastSlop && !this.press.longPressFired && !this.pinchActive;
      this.clearPress();
      if (isTap) {
        this.emitTap(sample);
      }
    }

    this.endPinchWhenAllPointersLifted();
  }

  private handleCancel(sample: TouchPointerSample): void {
    this.pointers.delete(sample.pointerId);
    if (this.press?.pointerId === sample.pointerId) {
      this.clearPress();
    }
    this.endPinchWhenAllPointersLifted();
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

  private beginPinch(): void {
    this.clearPress();
    this.pinchActive = true;
    this.previousPinchDistance = this.currentPinchDistance();
  }

  private emitPinchStep(): void {
    if (this.pointers.size < 2) {
      return;
    }
    const distance = this.currentPinchDistance();
    const previousDistance = this.previousPinchDistance;
    this.previousPinchDistance = distance;
    if (previousDistance === null || previousDistance <= 0 || distance <= 0) {
      return;
    }
    const [first, second] = this.pinchPointers();
    this.emit({
      kind: "pinch",
      scale: distance / previousDistance,
      centerX: (first.x + second.x) / 2,
      centerY: (first.y + second.y) / 2,
    });
  }

  private endPinchWhenAllPointersLifted(): void {
    if (this.pointers.size === 0) {
      this.pinchActive = false;
      this.previousPinchDistance = null;
      return;
    }
    if (this.pointers.size < 2) {
      this.previousPinchDistance = null;
    }
  }

  private emitTap(sample: TouchPointerSample): void {
    this.emit({ kind: "tap", x: sample.x, y: sample.y });

    const isSecondTap =
      this.lastTap !== null &&
      sample.time - this.lastTap.time <= DOUBLE_TAP_MS &&
      distanceBetween(this.lastTap, sample) <= DOUBLE_TAP_SLOP_PX;

    if (isSecondTap) {
      this.lastTap = null;
      this.emit({ kind: "double-tap", x: sample.x, y: sample.y });
      return;
    }

    this.lastTap = { x: sample.x, y: sample.y, time: sample.time };
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
}

function distanceBetween(a: PointerPosition, b: PointerPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
