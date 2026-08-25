import { describe, expect, it, vi } from "vitest";

import { removeArmyAttachmentsIfTracked, syncArmyAttachmentState } from "./army-attachment-state";

describe("syncArmyAttachmentState", () => {
  it("spawns attachments when a visible army gains a new signature and removes stale entries", () => {
    const activeArmyAttachmentEntities = new Set([1, 2]);
    const armyAttachmentSignatures = new Map([
      [1, "old"],
      [2, "stale"],
    ]);
    const spawnAttachments = vi.fn();
    const removeAttachments = vi.fn();

    syncArmyAttachmentState({
      visibleArmies: [
        { entityId: 1, attachments: [{ id: "banner", slot: "banner" }] },
        { entityId: 3, attachments: [{ id: "flag", slot: "flag" }] },
      ] as any,
      activeArmyAttachmentEntities,
      armyAttachmentSignatures,
      toNumericId: (entityId) => Number(entityId),
      getAttachmentSignature: (templates) => templates.map((template: any) => template.id).join("|"),
      spawnAttachments,
      removeAttachments,
    });

    expect(spawnAttachments).toHaveBeenCalledTimes(2);
    expect(removeAttachments).toHaveBeenCalledTimes(1);
    expect(removeAttachments).toHaveBeenCalledWith(2);
    expect(Array.from(activeArmyAttachmentEntities).sort()).toEqual([1, 3]);
    expect(Array.from(armyAttachmentSignatures.entries()).sort()).toEqual([
      [1, "banner"],
      [3, "flag"],
    ]);
  });

  it("removes tracked attachments when an army no longer has any templates", () => {
    const activeArmyAttachmentEntities = new Set([1]);
    const armyAttachmentSignatures = new Map([[1, "banner"]]);
    const removeAttachments = vi.fn();

    syncArmyAttachmentState({
      visibleArmies: [{ entityId: 1, attachments: [] }] as any,
      activeArmyAttachmentEntities,
      armyAttachmentSignatures,
      toNumericId: (entityId) => Number(entityId),
      getAttachmentSignature: () => "",
      spawnAttachments: vi.fn(),
      removeAttachments,
    });

    expect(removeAttachments).toHaveBeenCalledWith(1);
    expect(activeArmyAttachmentEntities.size).toBe(0);
    expect(armyAttachmentSignatures.size).toBe(0);
  });
});

describe("removeArmyAttachmentsIfTracked", () => {
  it("removes attachment state only when the army is tracked", () => {
    const activeArmyAttachmentEntities = new Set([7]);
    const armyAttachmentSignatures = new Map([[7, "banner"]]);
    const removeAttachments = vi.fn();

    removeArmyAttachmentsIfTracked({
      entityId: 7,
      activeArmyAttachmentEntities,
      armyAttachmentSignatures,
      removeAttachments,
    });

    expect(removeAttachments).toHaveBeenCalledWith(7);
    expect(activeArmyAttachmentEntities.size).toBe(0);
    expect(armyAttachmentSignatures.size).toBe(0);
  });
});
