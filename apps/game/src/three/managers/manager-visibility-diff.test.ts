import { describe, expect, it, vi } from "vitest";

import {
  commitManagerVisibilityDiff,
  commitManagerVisibilityDiffSliced,
  createManagerVisibilityDiff,
} from "./manager-visibility-diff";

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

/** Every remove/add costs `unitMs` of fake time; the clock only moves when work happens. */
function createFakeClock(unitMs: number) {
  let nowMs = 0;
  return {
    now: () => nowMs,
    spend: () => {
      nowMs += unitMs;
    },
  };
}

function createSlicedHarness(
  diff: ReturnType<typeof createDiff>,
  options: { unitMs: number; isCurrent?: () => boolean },
) {
  const clock = createFakeClock(options.unitMs);
  const log: string[] = [];
  const sliceMs: number[] = [];
  const scheduledOwners: string[] = [];
  const commitVisibleIds = vi.fn();

  const result = commitManagerVisibilityDiffSliced({
    diff,
    getEntityId: (entity: Entity) => entity.id,
    isCurrent: options.isCurrent ?? (() => true),
    remove: (entityId) => {
      log.push(`remove:${entityId}`);
      clock.spend();
    },
    add: ({ id }) => {
      log.push(`add:${id}`);
      clock.spend();
    },
    commitVisibleIds,
    schedule: async (work, owner) => {
      scheduledOwners.push(owner);
      log.push("slice");
      return work();
    },
    owner: "manager:test-full-refresh",
    sliceBudgetMs: 6,
    now: clock.now,
    endSlice: (ms) => sliceMs.push(ms),
  });

  return { result, log, sliceMs, scheduledOwners, commitVisibleIds };
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

describe("sliced manager visibility diff", () => {
  it("commits a 310-structure full refresh in time-boxed slices, each its own task under the owner", async () => {
    const ids = Array.from({ length: 310 }, (_, index) => index + 1);
    // 0.0625 ms per remove/add (exact in binary): a refreshed structure costs 0.125 ms, so a
    // 6 ms slice holds 48 of them and 310 need 7 slices.
    const harness = createSlicedHarness(createDiff(ids, ids, true), { unitMs: 0.0625 });

    await expect(harness.result).resolves.toBe(true);

    const sliceCount = harness.log.filter((entry) => entry === "slice").length;
    expect(sliceCount).toBe(7);
    expect(harness.scheduledOwners).toEqual(Array(sliceCount).fill("manager:test-full-refresh"));
    expect(Math.max(...harness.sliceMs)).toBe(6);
    expect(harness.commitVisibleIds).toHaveBeenCalledTimes(1);
    expect(harness.commitVisibleIds).toHaveBeenCalledWith(ids);
    expect(harness.log.filter((entry) => entry.startsWith("add:"))).toHaveLength(310);
    expect(harness.log.filter((entry) => entry.startsWith("remove:"))).toHaveLength(310);
  });

  it("refreshes a structure inside one slice: its remove and add never straddle a task boundary", async () => {
    const ids = Array.from({ length: 50 }, (_, index) => index + 1);
    const harness = createSlicedHarness(createDiff(ids, ids, true), { unitMs: 0.5 });

    await harness.result;

    const boundaries = harness.log.map((entry, index) => (entry === "slice" ? index : -1)).filter((index) => index > 0);
    boundaries.forEach((index) => {
      expect(harness.log[index - 1]).toMatch(/^add:/);
      expect(harness.log[index + 1]).toMatch(/^remove:/);
    });
    for (let index = 0; index < harness.log.length; index += 1) {
      const match = harness.log[index].match(/^remove:(\d+)$/);
      if (match) expect(harness.log[index + 1]).toBe(`add:${match[1]}`);
    }
  });

  it("removes leaving-only ids before refreshing, and adds entering-only entities last", async () => {
    const harness = createSlicedHarness(
      createManagerVisibilityDiff({
        currentVisibleIds: [1, 2, 3],
        nextVisibleEntities: [{ id: 2 }, { id: 3 }, { id: 4 }],
        getEntityId: (entity: Entity) => entity.id,
        refreshEntityIds: [2],
      }),
      { unitMs: 0.01 },
    );

    await harness.result;

    expect(harness.log).toEqual(["slice", "remove:1", "remove:2", "add:2", "add:4"]);
  });

  it("stops at the next slice boundary once the pass is superseded and never commits", async () => {
    const ids = Array.from({ length: 40 }, (_, index) => index + 1);
    let slicesStarted = 0;
    const harness = createSlicedHarness(createDiff(ids, ids, true), {
      unitMs: 0.5,
      isCurrent: () => {
        slicesStarted += 1;
        return slicesStarted === 1;
      },
    });

    await expect(harness.result).resolves.toBe(false);

    expect(harness.log.filter((entry) => entry === "slice")).toHaveLength(2);
    expect(harness.log.filter((entry) => entry.startsWith("add:")).length).toBeLessThan(ids.length);
    expect(harness.commitVisibleIds).not.toHaveBeenCalled();
  });

  it("brackets every slice with the begin and end hooks even when superseded", async () => {
    const beginSlice = vi.fn();
    const endSlice = vi.fn();

    await commitManagerVisibilityDiffSliced({
      diff: createDiff([1], [1], true),
      getEntityId: (entity: Entity) => entity.id,
      isCurrent: () => true,
      remove: vi.fn(),
      add: vi.fn(),
      commitVisibleIds: vi.fn(),
      schedule: async (work) => work(),
      owner: "manager:test-full-refresh",
      sliceBudgetMs: 6,
      beginSlice,
      endSlice,
    });

    expect(beginSlice).toHaveBeenCalledTimes(1);
    expect(endSlice).toHaveBeenCalledTimes(1);
  });
});
