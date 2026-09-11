import { describe, expect, it } from "vitest";
import type { ChestSpatialRenderable, GameSyncRuntimeStatus } from "@bibliothecadao/eternum/game-sync";
import { resolveChestTransition } from "./chest-transition-policy";

const chest: ChestSpatialRenderable = { kind: "chest", entityId: 7, hexCoords: { alt: false, col: 10, row: 20 } };
const created = { kind: "chest" as const, entityId: 7, current: chest };

describe("map chest transition eligibility", () => {
  it.each<GameSyncRuntimeStatus | undefined>([
    undefined,
    "idle",
    "subscribing",
    "snapshotting",
    "replaying",
    "stopped",
  ])("renders snapshot/recovery chests settled while sync is %s", (syncStatus) => {
    expect(resolveChestTransition({ change: created, syncStatus, isVisible: true, wasVisible: false })).toBeUndefined();
  });
  it("summons only a visible live creation", () => {
    expect(resolveChestTransition({ change: created, syncStatus: "running", isVisible: true, wasVisible: false })).toBe(
      "summon",
    );
    expect(
      resolveChestTransition({ change: created, syncStatus: "running", isVisible: false, wasVisible: false }),
    ).toBeUndefined();
  });
  it("does not replay a summon for an existing entity update", () => {
    expect(
      resolveChestTransition({
        change: { ...created, previous: chest },
        syncStatus: "running",
        isVisible: true,
        wasVisible: true,
      }),
    ).toBeUndefined();
  });
  it("opens only a previously visible chest removed from live state", () => {
    const change = { kind: "chest" as const, entityId: 7, previous: chest };
    expect(resolveChestTransition({ change, syncStatus: "running", isVisible: false, wasVisible: true })).toBe("open");
    expect(
      resolveChestTransition({ change, syncStatus: "snapshotting", isVisible: false, wasVisible: true }),
    ).toBeUndefined();
    expect(
      resolveChestTransition({ change, syncStatus: "running", isVisible: false, wasVisible: false }),
    ).toBeUndefined();
  });
});
