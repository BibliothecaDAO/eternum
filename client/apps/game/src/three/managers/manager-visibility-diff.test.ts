import { describe, expect, it, vi } from "vitest";

import { commitManagerVisibilityDiff, createManagerVisibilityDiff } from "./manager-visibility-diff";

interface Entity {
  id: number;
}

function createDiff(currentVisibleIds: number[], nextVisibleIds: number[], refreshExisting = false) {
  return createManagerVisibilityDiff({
    currentVisibleIds,
    nextVisibleEntities: nextVisibleIds.map((id) => ({ id })),
    getEntityId: (entity: Entity) => entity.id,
    refreshExisting,
  });
}

describe("manager visibility diff", () => {
  it("matches a clean projection for overlapping windows without scheduling staying entities", () => {
    const diff = createDiff([1, 2, 3], [2, 3, 4]);

    expect(diff.entering.map(({ id }) => id)).toEqual([4]);
    expect(diff.leaving).toEqual([1]);
    expect(diff.staying).toEqual([2, 3]);
    expect(diff.visibleIds).toEqual([2, 3, 4]);
  });

  it("matches clean projections for disjoint and empty windows", () => {
    expect(createDiff([1, 2], [3, 4])).toEqual({
      entering: [{ id: 3 }, { id: 4 }],
      leaving: [1, 2],
      staying: [],
      visibleIds: [3, 4],
    });
    expect(createDiff([1, 2], [])).toEqual({
      entering: [],
      leaving: [1, 2],
      staying: [],
      visibleIds: [],
    });
  });

  it("does not mutate or commit a superseded projection", () => {
    const remove = vi.fn();
    const add = vi.fn();
    const commitVisibleIds = vi.fn();

    const committed = commitManagerVisibilityDiff({
      diff: createDiff([1, 2], [2, 3]),
      isCurrent: () => false,
      remove,
      add,
      commitVisibleIds,
    });

    expect(committed).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(commitVisibleIds).not.toHaveBeenCalled();
  });

  it("rebuilds shared entities only when an explicit refresh owns the pass", () => {
    const diff = createDiff([1, 2], [2, 3], true);

    expect(diff.entering.map(({ id }) => id)).toEqual([2, 3]);
    expect(diff.leaving).toEqual([1, 2]);
    expect(diff.staying).toEqual([]);
  });

  it("rebuilds only explicitly targeted staying entities", () => {
    const diff = createManagerVisibilityDiff({
      currentVisibleIds: [1, 2, 3],
      nextVisibleEntities: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
      getEntityId: (entity: Entity) => entity.id,
      refreshEntityIds: [2],
    });

    expect(diff.entering.map(({ id }) => id)).toEqual([2, 4]);
    expect(diff.leaving).toEqual([2]);
    expect(diff.staying).toEqual([1, 3]);
  });

  it("keeps exact rendered ownership through ten overlapping crossings without scheduling staying IDs", () => {
    let renderedIds = new Set<number>();
    const scheduledAdds: number[] = [];
    const scheduledRemoves: number[] = [];

    for (let crossing = 0; crossing < 10; crossing += 1) {
      const projectedIds = Array.from({ length: 5 }, (_, offset) => crossing + offset);
      const diff = createDiff([...renderedIds], projectedIds);

      if (crossing === 5) {
        const renderedBeforeSupersession = [...renderedIds];
        commitManagerVisibilityDiff({
          diff: createDiff(
            [...renderedIds],
            projectedIds.map((id) => id + 100),
          ),
          isCurrent: () => false,
          remove: (entityId) => scheduledRemoves.push(entityId),
          add: ({ id }) => scheduledAdds.push(id),
          commitVisibleIds: (visibleIds) => {
            renderedIds = new Set(visibleIds);
          },
        });
        expect([...renderedIds]).toEqual(renderedBeforeSupersession);
      }

      expect(diff.entering.map(({ id }) => id).filter((id) => diff.staying.includes(id))).toEqual([]);
      expect(diff.leaving.filter((id) => diff.staying.includes(id))).toEqual([]);

      commitManagerVisibilityDiff({
        diff,
        isCurrent: () => true,
        remove: (entityId) => {
          scheduledRemoves.push(entityId);
          renderedIds.delete(entityId);
        },
        add: ({ id }) => {
          scheduledAdds.push(id);
          renderedIds.add(id);
        },
        commitVisibleIds: (visibleIds) => {
          renderedIds = new Set(visibleIds);
        },
      });

      expect([...renderedIds]).toEqual(projectedIds);
    }

    expect(scheduledAdds).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(scheduledRemoves).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const cleanProjectionScheduledEntityWork = 10 * 5;
    expect(1 - scheduledAdds.length / cleanProjectionScheduledEntityWork).toBeGreaterThanOrEqual(0.7);
  });
});
