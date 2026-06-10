// @vitest-environment node
import type { ActionPath } from "@bibliothecadao/eternum";
import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import {
  computeEffectiveStaminaCost,
  filterFreshExplorationPaths,
  getPathStaminaCost,
  normalizeExplorationNextRunAt,
  selectDueEntries,
  shouldRepeatExplore,
} from "./exploration-automation-planner";

const step = (cost: number, actionType: ActionType = ActionType.Move): ActionPath => ({
  hex: { col: 0, row: 0 },
  actionType,
  staminaCost: cost,
});

describe("getPathStaminaCost", () => {
  it("sums staminaCost across steps", () => {
    expect(getPathStaminaCost([step(1), step(2), step(3)])).toBe(6);
  });

  it("treats missing staminaCost as zero", () => {
    expect(getPathStaminaCost([{ staminaCost: undefined }, { staminaCost: 5 }])).toBe(5);
  });

  it("returns 0 for an empty path", () => {
    expect(getPathStaminaCost([])).toBe(0);
  });
});

describe("computeEffectiveStaminaCost", () => {
  it("uses path cost when positive", () => {
    expect(computeEffectiveStaminaCost([step(2), step(3)], ActionType.Explore, 10)).toBe(5);
  });

  it("falls back to exploreStaminaCost only when path cost is 0 and action is Explore", () => {
    expect(computeEffectiveStaminaCost([], ActionType.Explore, 12)).toBe(12);
    expect(computeEffectiveStaminaCost([step(0)], ActionType.Explore, 9)).toBe(9);
  });

  it("keeps zero cost for non-Explore actions", () => {
    expect(computeEffectiveStaminaCost([], ActionType.Move, 12)).toBe(0);
  });
});

describe("shouldRepeatExplore", () => {
  it("repeats only when action is Explore and remaining stamina >= cost", () => {
    expect(shouldRepeatExplore(ActionType.Explore, 10, 10)).toBe(true);
    expect(shouldRepeatExplore(ActionType.Explore, 9, 10)).toBe(false);
    expect(shouldRepeatExplore(ActionType.Move, 100, 10)).toBe(false);
    expect(shouldRepeatExplore(undefined, 100, 10)).toBe(false);
  });
});

describe("normalizeExplorationNextRunAt", () => {
  it("passes through finite numbers", () => {
    expect(normalizeExplorationNextRunAt(123)).toBe(123);
  });

  it("coerces numeric strings", () => {
    expect(normalizeExplorationNextRunAt("42")).toBe(42);
  });

  it("returns null for null/undefined/NaN/non-numeric", () => {
    expect(normalizeExplorationNextRunAt(null)).toBeNull();
    expect(normalizeExplorationNextRunAt(undefined)).toBeNull();
    expect(normalizeExplorationNextRunAt("abc")).toBeNull();
    expect(normalizeExplorationNextRunAt(Number.NaN)).toBeNull();
  });
});

describe("selectDueEntries", () => {
  it("returns entries with null nextRunAt or nextRunAt <= now", () => {
    const now = 1_000;
    const entries = [
      { id: "a", nextRunAt: null },
      { id: "b", nextRunAt: 500 },
      { id: "c", nextRunAt: 2_000 },
      { id: "d", nextRunAt: 1_000 },
      { id: "e", nextRunAt: "not-a-number" as unknown as number },
    ];
    const due = selectDueEntries(entries, now);
    expect(due.map((e) => e.id)).toEqual(["a", "b", "d", "e"]);
  });
});

describe("filterFreshExplorationPaths", () => {
  const buildPath = (actionType: ActionType, col: number, row: number): ActionPath[] => [
    { hex: { col: 0, row: 0 }, actionType, staminaCost: 0 },
    { hex: { col, row }, actionType, staminaCost: 0 },
  ];

  const identityNormalize = (hex: { col: number; row: number }) => ({ x: hex.col, y: hex.row });

  it("keeps only Explore paths whose endpoint is not recently explored", () => {
    const actionPathMap = new Map<string, ActionPath[]>([
      ["a", buildPath(ActionType.Explore, 1, 1)],
      ["b", buildPath(ActionType.Explore, 2, 2)],
      ["c", buildPath(ActionType.Move, 3, 3)],
    ]);
    const recentlyExplored = new Set<string>(["1,1"]);
    const result = filterFreshExplorationPaths(actionPathMap, recentlyExplored, identityNormalize);
    expect(Array.from(result.keys())).toEqual(["b"]);
  });

  it("ignores paths without an endpoint hex", () => {
    const actionPathMap = new Map<string, ActionPath[]>([["a", []]]);
    const result = filterFreshExplorationPaths(actionPathMap, new Set(), identityNormalize);
    expect(result.size).toBe(0);
  });

  it("passes hex coords through the normalize callback", () => {
    const actionPathMap = new Map<string, ActionPath[]>([["a", buildPath(ActionType.Explore, 5, 7)]]);
    const normalize = (hex: { col: number; row: number }) => ({ x: hex.col + 10, y: hex.row + 10 });
    // After normalization -> "15,17" — we mark it recently explored, should filter it out.
    const recentlyExplored = new Set<string>(["15,17"]);
    const result = filterFreshExplorationPaths(actionPathMap, recentlyExplored, normalize);
    expect(result.size).toBe(0);
  });
});
