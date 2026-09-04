import { InstancedBufferAttribute } from "three";
import { describe, expect, it } from "vitest";
import { createSlotDirtyRange, flushSlotDirtyRange, hasDirtySlots, markSlotDirty } from "./instance-update-ranges";

describe("instance update ranges", () => {
  it("starts empty and widens to the touched slots", () => {
    const range = createSlotDirtyRange();
    expect(hasDirtySlots(range)).toBe(false);
    markSlotDirty(range, 7);
    markSlotDirty(range, 3);
    expect(range).toEqual({ min: 3, max: 7 });
  });

  it("queues one upload range per attribute scaled by its item size and bumps the version", () => {
    const matrices = new InstancedBufferAttribute(new Float32Array(16 * 8), 16);
    const colors = new InstancedBufferAttribute(new Float32Array(3 * 8), 3);
    const range = createSlotDirtyRange();
    markSlotDirty(range, 2);
    markSlotDirty(range, 4);

    expect(flushSlotDirtyRange(range, [matrices, colors, undefined])).toBe(3);

    expect(matrices.updateRanges).toEqual([{ start: 32, count: 48 }]);
    expect(colors.updateRanges).toEqual([{ start: 6, count: 9 }]);
    expect(matrices.version).toBe(1);
    expect(hasDirtySlots(range)).toBe(false);
  });

  it("does nothing while no slot is dirty", () => {
    const matrices = new InstancedBufferAttribute(new Float32Array(16), 16);
    expect(flushSlotDirtyRange(createSlotDirtyRange(), [matrices])).toBe(0);
    expect(matrices.updateRanges).toEqual([]);
    expect(matrices.version).toBe(0);
  });

  it("keeps a queued range when a second flush lands before the upload", () => {
    const matrices = new InstancedBufferAttribute(new Float32Array(16 * 8), 16);
    const range = createSlotDirtyRange();
    markSlotDirty(range, 0);
    flushSlotDirtyRange(range, [matrices]);
    markSlotDirty(range, 5);
    flushSlotDirtyRange(range, [matrices]);
    expect(matrices.updateRanges).toEqual([
      { start: 0, count: 16 },
      { start: 80, count: 16 },
    ]);
  });
});
