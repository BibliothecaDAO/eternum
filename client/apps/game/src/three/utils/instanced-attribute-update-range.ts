import type { InstancedBufferAttribute } from "three";

export const markInstancedAttributeRangeDirty = (
  attribute: InstancedBufferAttribute,
  instanceStart: number,
  instanceCount: number,
): void => {
  if (instanceCount <= 0) {
    return;
  }

  const itemSize = attribute.itemSize;
  let componentStart = instanceStart * itemSize;
  let componentEnd = componentStart + instanceCount * itemSize;

  attribute.updateRanges.forEach((range) => {
    if (range.count <= 0) {
      return;
    }

    componentStart = Math.min(componentStart, range.start);
    componentEnd = Math.max(componentEnd, range.start + range.count);
  });

  attribute.clearUpdateRanges();
  attribute.addUpdateRange(componentStart, componentEnd - componentStart);
  attribute.needsUpdate = true;
};
