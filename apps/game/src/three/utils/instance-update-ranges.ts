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
    attribute.addUpdateRange(range.min * attribute.itemSize, count * attribute.itemSize);
    attribute.needsUpdate = true;
  }
  range.min = Number.POSITIVE_INFINITY;
  range.max = -1;
  return count;
}
