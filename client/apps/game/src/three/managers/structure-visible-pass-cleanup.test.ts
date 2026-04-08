import { describe, expect, it, vi } from "vitest";

import { cleanupVisibleStructurePass } from "./structure-visible-pass-cleanup";

describe("cleanupVisibleStructurePass", () => {
  it("removes stale attachments, labels, and points, then returns the next visible set", () => {
    const activeAttachmentEntities = new Set([1, 2, 3]);
    const attachmentSignatures = new Map([
      [1, "one"],
      [2, "two"],
      [3, "three"],
    ]);
    const removeAttachments = vi.fn();
    const removeEntityIdLabel = vi.fn();
    const removeStructurePoint = vi.fn();
    const visibleStructureIds = new Set([1, 4]);
    const previousVisibleIds = new Set([2, 4, 5]);

    const nextVisibleIds = cleanupVisibleStructurePass({
      retainedAttachmentEntities: new Set([1]),
      activeAttachmentEntities,
      attachmentSignatures,
      removeAttachments,
      trackedLabelEntityIds: [1, 2, 6],
      visibleStructureIds,
      removeEntityIdLabel,
      previousVisibleIds,
      getStructureByEntityId: (entityId) => (entityId === 2 ? { entityId } : entityId === 5 ? undefined : { entityId }),
      removeStructurePoint,
    });

    expect(removeAttachments).toHaveBeenCalledTimes(2);
    expect(removeAttachments).toHaveBeenCalledWith(2);
    expect(removeAttachments).toHaveBeenCalledWith(3);
    expect(Array.from(activeAttachmentEntities)).toEqual([1]);
    expect(Array.from(attachmentSignatures.entries())).toEqual([[1, "one"]]);
    expect(removeEntityIdLabel).toHaveBeenCalledTimes(2);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(2);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(6);
    expect(removeStructurePoint).toHaveBeenCalledTimes(1);
    expect(removeStructurePoint).toHaveBeenCalledWith(2, { entityId: 2 });
    expect(nextVisibleIds).toBe(visibleStructureIds);
  });

  it("leaves state unchanged when nothing is retired", () => {
    const activeAttachmentEntities = new Set([1]);
    const attachmentSignatures = new Map([[1, "one"]]);
    const removeAttachments = vi.fn();
    const removeEntityIdLabel = vi.fn();
    const removeStructurePoint = vi.fn();
    const visibleStructureIds = new Set([1, 2]);

    const nextVisibleIds = cleanupVisibleStructurePass({
      retainedAttachmentEntities: new Set([1]),
      activeAttachmentEntities,
      attachmentSignatures,
      removeAttachments,
      trackedLabelEntityIds: [1, 2],
      visibleStructureIds,
      removeEntityIdLabel,
      previousVisibleIds: new Set([1, 2]),
      getStructureByEntityId: (entityId) => ({ entityId }),
      removeStructurePoint,
    });

    expect(removeAttachments).not.toHaveBeenCalled();
    expect(removeEntityIdLabel).not.toHaveBeenCalled();
    expect(removeStructurePoint).not.toHaveBeenCalled();
    expect(nextVisibleIds).toBe(visibleStructureIds);
  });
});
