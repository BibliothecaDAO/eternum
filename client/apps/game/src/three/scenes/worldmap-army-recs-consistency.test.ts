import { describe, expect, it } from "vitest";
import type { ID } from "@bibliothecadao/types";
import {
  ARMY_RECS_MISSING_CONFIRM_MS,
  ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS,
  evaluateArmyRecsConsistency,
  type ArmyRecsConsistencyAction,
  type ArmyRecsConsistencyCandidate,
} from "./worldmap-army-recs-consistency";

const NOW_MS = 1_000_000;

function makeCandidate(overrides: Partial<ArmyRecsConsistencyCandidate> = {}): ArmyRecsConsistencyCandidate {
  return {
    entityId: 42 as ID,
    renderedPosition: { col: 10, row: 10 },
    recs: { troopCount: 100, normalizedCoord: { col: 10, row: 10 } },
    isVisibleInCurrentChunk: true,
    hasPendingMovement: false,
    isMoving: false,
    hasOptimisticState: false,
    pendingRemovalScheduledAtMs: null,
    ...overrides,
  };
}

interface ConsistencyCase {
  name: string;
  candidate: ArmyRecsConsistencyCandidate;
  missingSince?: ReadonlyArray<[ID, number]>;
  expected: ArmyRecsConsistencyAction[];
}

describe("evaluateArmyRecsConsistency", () => {
  const cases: ConsistencyCase[] = [
    {
      name: "skips synthetic negative pending-create ids entirely",
      candidate: makeCandidate({ entityId: -7 as ID, recs: { troopCount: 0, normalizedCoord: null } }),
      expected: [],
    },
    {
      name: "skips zero entity id",
      candidate: makeCandidate({ entityId: 0 as ID, recs: { troopCount: 0, normalizedCoord: null } }),
      expected: [],
    },
    {
      name: "skips armies with pending movement",
      candidate: makeCandidate({ hasPendingMovement: true, recs: { troopCount: 0, normalizedCoord: null } }),
      expected: [],
    },
    {
      name: "skips armies that are moving",
      candidate: makeCandidate({ isMoving: true, recs: { troopCount: 0, normalizedCoord: null } }),
      expected: [],
    },
    {
      name: "skips armies with optimistic state",
      candidate: makeCandidate({ hasOptimisticState: true, recs: { troopCount: 0, normalizedCoord: null } }),
      expected: [],
    },
    {
      name: "removes dead army when troop count is zero and no removal is pending",
      candidate: makeCandidate({ recs: { troopCount: 0, normalizedCoord: { col: 10, row: 10 } } }),
      expected: [{ kind: "remove_dead", entityId: 42 as ID, cause: "zero_troops" }],
    },
    {
      name: "leaves zero-troop army to its fresh pending removal timeout",
      candidate: makeCandidate({
        recs: { troopCount: 0, normalizedCoord: { col: 10, row: 10 } },
        pendingRemovalScheduledAtMs: NOW_MS - 1_000,
      }),
      expected: [],
    },
    {
      name: "removes zero-troop army whose pending removal timer is stuck",
      candidate: makeCandidate({
        recs: { troopCount: 0, normalizedCoord: { col: 10, row: 10 } },
        pendingRemovalScheduledAtMs: NOW_MS - ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS,
      }),
      expected: [{ kind: "remove_dead", entityId: 42 as ID, cause: "zero_troops" }],
    },
    {
      name: "missing component outside current chunk only clears tracked missing state",
      candidate: makeCandidate({
        recs: { troopCount: null, normalizedCoord: null },
        isVisibleInCurrentChunk: false,
      }),
      missingSince: [[42 as ID, NOW_MS - 1_000]],
      expected: [{ kind: "clear_missing", entityId: 42 as ID }],
    },
    {
      name: "missing component outside current chunk with no tracking emits nothing",
      candidate: makeCandidate({
        recs: { troopCount: null, normalizedCoord: null },
        isVisibleInCurrentChunk: false,
      }),
      expected: [],
    },
    {
      name: "missing component in current chunk marks missing on first strike",
      candidate: makeCandidate({ recs: { troopCount: null, normalizedCoord: null } }),
      expected: [{ kind: "mark_missing", entityId: 42 as ID }],
    },
    {
      name: "missing component still within confirm window emits nothing",
      candidate: makeCandidate({ recs: { troopCount: null, normalizedCoord: null } }),
      missingSince: [[42 as ID, NOW_MS - (ARMY_RECS_MISSING_CONFIRM_MS - 1)]],
      expected: [],
    },
    {
      name: "missing component confirmed past window removes dead",
      candidate: makeCandidate({ recs: { troopCount: null, normalizedCoord: null } }),
      missingSince: [[42 as ID, NOW_MS - ARMY_RECS_MISSING_CONFIRM_MS]],
      expected: [{ kind: "remove_dead", entityId: 42 as ID, cause: "missing_component" }],
    },
    {
      name: "reappeared component clears tracked missing state",
      candidate: makeCandidate({ recs: { troopCount: 100, normalizedCoord: { col: 10, row: 10 } } }),
      missingSince: [[42 as ID, NOW_MS - 1_000]],
      expected: [{ kind: "clear_missing", entityId: 42 as ID }],
    },
    {
      name: "snaps rendered position to RECS coord on mismatch",
      candidate: makeCandidate({
        renderedPosition: { col: 10, row: 10 },
        recs: { troopCount: 100, normalizedCoord: { col: 12, row: 9 } },
      }),
      expected: [{ kind: "snap_position", entityId: 42 as ID, to: { col: 12, row: 9 } }],
    },
    {
      name: "emits nothing when rendered position matches RECS coord",
      candidate: makeCandidate({
        renderedPosition: { col: 10, row: 10 },
        recs: { troopCount: 100, normalizedCoord: { col: 10, row: 10 } },
      }),
      expected: [],
    },
    {
      name: "emits nothing for coord check when rendered position is unknown",
      candidate: makeCandidate({
        renderedPosition: undefined,
        recs: { troopCount: 100, normalizedCoord: { col: 12, row: 9 } },
      }),
      expected: [],
    },
    {
      name: "restores alive army hidden by a stale pending removal",
      candidate: makeCandidate({
        recs: { troopCount: 100, normalizedCoord: { col: 10, row: 10 } },
        pendingRemovalScheduledAtMs: NOW_MS - ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS,
      }),
      expected: [{ kind: "restore_alive", entityId: 42 as ID }],
    },
    {
      name: "does not restore alive army while pending removal is still fresh",
      candidate: makeCandidate({
        recs: { troopCount: 100, normalizedCoord: { col: 10, row: 10 } },
        pendingRemovalScheduledAtMs: NOW_MS - (ARMY_RECS_STUCK_REMOVAL_MAX_AGE_MS - 1),
      }),
      expected: [],
    },
  ];

  cases.forEach(({ name, candidate, missingSince, expected }) => {
    it(name, () => {
      const actions = evaluateArmyRecsConsistency({
        candidates: [candidate],
        missingSince: new Map(missingSince ?? []),
        nowMs: NOW_MS,
      });

      expect(actions).toEqual(expected);
    });
  });

  it("evaluates each candidate independently within a single sweep", () => {
    const actions = evaluateArmyRecsConsistency({
      candidates: [
        makeCandidate({ entityId: 1 as ID, recs: { troopCount: 0, normalizedCoord: null } }),
        makeCandidate({ entityId: 2 as ID, recs: { troopCount: null, normalizedCoord: null } }),
        makeCandidate({ entityId: 3 as ID, isMoving: true, recs: { troopCount: 0, normalizedCoord: null } }),
        makeCandidate({
          entityId: 4 as ID,
          renderedPosition: { col: 1, row: 1 },
          recs: { troopCount: 50, normalizedCoord: { col: 2, row: 2 } },
        }),
      ],
      missingSince: new Map(),
      nowMs: NOW_MS,
    });

    expect(actions).toEqual([
      { kind: "remove_dead", entityId: 1 as ID, cause: "zero_troops" },
      { kind: "mark_missing", entityId: 2 as ID },
      { kind: "snap_position", entityId: 4 as ID, to: { col: 2, row: 2 } },
    ]);
  });

  it("emits clear_missing alongside remove_dead when a tracked component reappears already dead", () => {
    const actions = evaluateArmyRecsConsistency({
      candidates: [makeCandidate({ recs: { troopCount: 0, normalizedCoord: { col: 10, row: 10 } } })],
      missingSince: new Map([[42 as ID, NOW_MS - 1_000]]),
      nowMs: NOW_MS,
    });

    expect(actions).toEqual([
      { kind: "clear_missing", entityId: 42 as ID },
      { kind: "remove_dead", entityId: 42 as ID, cause: "zero_troops" },
    ]);
  });
});
