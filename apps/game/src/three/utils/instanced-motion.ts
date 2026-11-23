import type Node from "three/src/nodes/core/Node.js";
import { InstancedBufferAttribute, Matrix4, Vector3 } from "three";
import { abs, clamp, cos, exp, float, max, select, sin, smoothstep } from "three/tsl";
import type { AnimationVisibilityContext } from "../types/animation";
import { isAnimationPositionVisible } from "../utils/animation-visibility";

export const INSTANCED_MOTION_GOLDEN_PHASE = 2.399963;

export interface MotionMathOps<T> {
  num(value: number): T;
  add(a: T, b: T): T;
  sub(a: T, b: T): T;
  mul(a: T, b: T): T;
  div(a: T, b: T): T;
  sin(a: T): T;
  cos(a: T): T;
  abs(a: T): T;
  exp(a: T): T;
  max(a: T, b: T): T;
  clamp(a: T, min: number, max: number): T;
  smoothstep(edge0: number, edge1: number, x: T): T;
  selectGt(a: T, threshold: number, whenTrue: T, whenFalse: T): T;
  selectGte(a: T, threshold: number, whenTrue: T, whenFalse: T): T;
  selectBetween(a: T, low: number, high: number, whenTrue: T, whenFalse: T): T;
}

export const CPU_MOTION_OPS: MotionMathOps<number> = {
  num: (value) => value,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  mul: (a, b) => a * b,
  div: (a, b) => a / b,
  sin: Math.sin,
  cos: Math.cos,
  abs: Math.abs,
  exp: Math.exp,
  max: Math.max,
  clamp: (a, lo, hi) => Math.min(hi, Math.max(lo, a)),
  smoothstep: (edge0, edge1, x) => {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  },
  selectGt: (a, threshold, whenTrue, whenFalse) => (a > threshold ? whenTrue : whenFalse),
  selectGte: (a, threshold, whenTrue, whenFalse) => (a >= threshold ? whenTrue : whenFalse),
  selectBetween: (a, low, high, whenTrue, whenFalse) => (a > low && a < high ? whenTrue : whenFalse),
};

export const TSL_MOTION_OPS: MotionMathOps<Node<"float">> = {
  num: (value) => float(value),
  add: (a, b) => a.add(b),
  sub: (a, b) => a.sub(b),
  mul: (a, b) => a.mul(b),
  div: (a, b) => a.div(b),
  sin: (a) => sin(a),
  cos: (a) => cos(a),
  abs: (a) => abs(a),
  exp: (a) => exp(a),
  max: (a, b) => max(a, b),
  clamp: (a, lo, hi) => clamp(a, lo, hi),
  smoothstep: (edge0, edge1, x) => smoothstep(edge0, edge1, x),
  selectGt: (a, threshold, whenTrue, whenFalse) => select(a.greaterThan(threshold), whenTrue, whenFalse),
  selectGte: (a, threshold, whenTrue, whenFalse) => select(a.greaterThanEqual(threshold), whenTrue, whenFalse),
  selectBetween: (a, low, high, whenTrue, whenFalse) =>
    select(a.greaterThan(low).and(a.lessThan(high)), whenTrue, whenFalse),
};

export interface InstancedMotionSlotState<TAction extends string> {
  readonly action: TAction;
  readonly progress: number;
  readonly clock: number;
  readonly active: boolean;
}

interface InstancedMotionConfig<TAction extends string> {
  readonly idleAction: TAction;
  readonly actionCodes: Readonly<Record<TAction, number>>;
  readonly codeToAction: readonly TAction[];
  readonly oneShotDurations: Readonly<Partial<Record<TAction, number>>>;
  readonly persistentDurations: Readonly<Partial<Record<TAction, number>>>;
  readonly resolveLoopAction?: (index: number) => TAction;
}

const scratchPosition = new Vector3();

export class InstancedMotionController<TAction extends string> {
  public readonly attribute: InstancedBufferAttribute;
  private readonly config: InstancedMotionConfig<TAction>;
  private readonly positions: Float32Array;
  private readonly capacity: number;
  private readonly activeOneShots = new Map<number, number>();
  private currentTime = 0;

  constructor(config: InstancedMotionConfig<TAction>, capacity: number) {
    this.config = config;
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    this.attribute = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    const idleCode = config.actionCodes[config.idleAction];
    for (let i = 0; i < capacity; i++) {
      this.attribute.setXYZW(i, idleCode, 0, 1, 1);
    }
  }

  public setPlacementAt(index: number, matrix: Matrix4): void {
    if (index < 0 || index >= this.capacity) return;
    const base = index * 3;
    this.positions[base] = matrix.elements[12];
    this.positions[base + 1] = matrix.elements[13];
    this.positions[base + 2] = matrix.elements[14];
  }

  private resolveSlotLoopAction(index: number): TAction {
    return this.config.resolveLoopAction ? this.config.resolveLoopAction(index) : this.config.idleAction;
  }

  public resetSlot(index: number): void {
    if (index < 0 || index >= this.capacity) return;
    const idleCode = this.config.actionCodes[this.config.idleAction];
    const wasCleared = this.activeOneShots.delete(index);
    const alreadyClean =
      Math.round(this.attribute.getX(index)) === idleCode &&
      this.attribute.getY(index) === 0 &&
      this.attribute.getZ(index) === 1 &&
      this.attribute.getW(index) === 1;
    if (!alreadyClean) {
      this.attribute.setXYZW(index, idleCode, 0, 1, 1);
      this.attribute.needsUpdate = true;
    } else if (wasCleared) {
      this.attribute.needsUpdate = true;
    }
  }

  public playActionAt(index: number, action: TAction, nowSeconds = this.currentTime): void {
    if (index < 0 || index >= this.capacity) return;
    if (this.attribute.getW(index) <= 0.5 && action !== this.config.idleAction) return;
    const code = this.config.actionCodes[action];
    const oneShotDuration = this.config.oneShotDurations[action];
    const persistentDuration = this.config.persistentDurations[action];
    const duration = oneShotDuration ?? persistentDuration ?? 1;
    this.attribute.setXYZ(index, code, nowSeconds, duration);
    this.attribute.needsUpdate = true;
    if (oneShotDuration !== undefined) {
      this.activeOneShots.set(index, nowSeconds + oneShotDuration);
    } else {
      this.activeOneShots.delete(index);
    }
  }

  public syncLoopActionAt(index: number): void {
    if (index < 0 || index >= this.capacity) return;
    if (this.activeOneShots.has(index)) return;
    const currentCode = Math.round(this.attribute.getX(index));
    const currentAction = this.config.codeToAction[currentCode];
    if (currentAction && this.config.persistentDurations[currentAction] !== undefined) return;
    const desiredCode = this.config.actionCodes[this.resolveSlotLoopAction(index)];
    if (currentCode !== desiredCode) {
      this.attribute.setXYZ(index, desiredCode, this.currentTime, 1);
      this.attribute.needsUpdate = true;
    }
  }

  public getStateAt(index: number, nowSeconds = this.currentTime): InstancedMotionSlotState<TAction> {
    if (index < 0 || index >= this.capacity) {
      return { action: this.config.idleAction, progress: 0, clock: nowSeconds, active: false };
    }
    const code = Math.round(this.attribute.getX(index));
    const action = this.config.codeToAction[code] ?? this.config.idleAction;
    const startTime = this.attribute.getY(index);
    const duration = Math.max(0.001, this.attribute.getZ(index));
    const active = this.attribute.getW(index) > 0.5;
    const isTimed =
      this.config.oneShotDurations[action] !== undefined || this.config.persistentDurations[action] !== undefined;
    const progress = isTimed && active ? Math.min(1, Math.max(0, (nowSeconds - startTime) / duration)) : 0;
    return { action, progress, clock: active ? nowSeconds + index * INSTANCED_MOTION_GOLDEN_PHASE : 0, active };
  }

  public update(nowSeconds: number, activeSlots: Iterable<number>, visibility?: AnimationVisibilityContext): number {
    this.currentTime = Number.isFinite(nowSeconds) ? nowSeconds : this.currentTime;
    let dirty = false;

    for (const [slot, endTime] of this.activeOneShots) {
      if (this.currentTime >= endTime) {
        const resumeAction = this.resolveSlotLoopAction(slot);
        this.attribute.setXYZ(slot, this.config.actionCodes[resumeAction], 0, 1);
        this.activeOneShots.delete(slot);
        dirty = true;
      }
    }

    let visibleCount = 0;
    if (visibility) {
      for (const index of activeSlots) {
        if (index < 0 || index >= this.capacity) continue;
        const base = index * 3;
        scratchPosition.set(this.positions[base], this.positions[base + 1], this.positions[base + 2]);
        const visible = isAnimationPositionVisible(scratchPosition, visibility);
        const prevActive = this.attribute.getW(index) > 0.5;
        if (visible !== prevActive) {
          this.attribute.setW(index, visible ? 1 : 0);
          if (!visible && this.activeOneShots.has(index)) {
            const resumeAction = this.resolveSlotLoopAction(index);
            this.attribute.setXYZ(index, this.config.actionCodes[resumeAction], 0, 1);
            this.activeOneShots.delete(index);
          }
          dirty = true;
        }
        if (visible) visibleCount++;
      }
    }

    if (dirty) this.attribute.needsUpdate = true;
    return visibleCount;
  }
}
