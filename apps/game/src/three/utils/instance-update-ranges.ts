import type { BufferAttribute } from "three";

/** The contiguous span of instance slots written since the last flush; empty while `min > max`. */
export interface SlotDirtyRange {
  min: number;
  max: number;
}

export const createSlotDirtyRange = (): SlotDirtyRange => ({ min: Number.POSITIVE_INFINITY, max: -1 });

export const markSlotDirty = (range: SlotDirtyRange, slot: number): void => {
  if (slot < range.min) range.min = slot;
  if (slot > range.max) range.max = slot;
};

export const hasDirtySlots = (range: SlotDirtyRange): boolean => range.min <= range.max;

/**
 * Queues one GPU upload range per attribute covering the dirty span, then clears the span.
 * Ranges accumulate until three uploads and drops them, so several flushes before one render
 * never lose a span. Returns the number of slots queued.
 */
export function flushSlotDirtyRange(
  range: SlotDirtyRange,
  attributes: Iterable<BufferAttribute | null | undefined>,
): number {
  if (!hasDirtySlots(range)) return 0;
  const count = range.max - range.min + 1;
  for (const attribute of attributes) {
    if (!attribute) continue;
    queueInstanceUpdate(attribute, range.min, count);
  }
  range.min = Number.POSITIVE_INFINITY;
  range.max = -1;
  return count;
}

/** Keep pending uploads bounded when an offscreen mesh is updated repeatedly before a draw. */
export function queueInstanceUpdate(attribute: BufferAttribute, firstSlot: number, slotCount: number): void {
  const start = firstSlot * attribute.itemSize;
  const count = slotCount * attribute.itemSize;
  const queued = attribute.updateRanges.find((range) => range.start === start);
  if (queued) queued.count = Math.max(queued.count, count);
  else attribute.addUpdateRange(start, count);
  attribute.needsUpdate = true;
}
