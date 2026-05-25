// @vitest-environment node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSource(relativePath: string): string {
  return readFileSync(resolve(currentDir, relativePath), "utf8");
}

function extractSourceBetween(source: string, startSignature: string, endSignature: string): string {
  const start = source.indexOf(startSignature);
  const end = source.indexOf(endSignature, start + startSignature.length);
  if (start === -1 || end === -1) {
    return "";
  }

  return source.slice(start, end);
}

describe("worldmap create-army ghost wiring", () => {
  it("dispatches create-army pending feedback with troop identity instead of a resource icon id", () => {
    const pendingFxSource = readSource("../../utils/pending-worldmap-fx.ts");
    const armyCardSource = readSource("../../ui/features/military/components/army-management-card.tsx");
    const unifiedModalSource = readSource(
      "../../ui/features/military/components/unified-army-creation-modal/unified-army-creation-modal.tsx",
    );

    expect(pendingFxSource).toContain("troopType: TroopType");
    expect(pendingFxSource).toContain("troopTier: TroopTier");
    expect(pendingFxSource).not.toContain("troopResourceId");

    expect(armyCardSource).toContain("troopType");
    expect(armyCardSource).toContain("troopTier");
    expect(extractSourceBetween(armyCardSource, 'kind: "create-army"', "});")).not.toContain("troopResourceId");

    expect(unifiedModalSource).toContain("troopType");
    expect(unifiedModalSource).toContain("troopTier");
    expect(extractSourceBetween(unifiedModalSource, 'kind: "create-army"', "});")).not.toContain("troopResourceId");
  });

  it("routes create-army pending feedback through arrival ghosts instead of resource-icon FX", () => {
    const source = readSource("worldmap.tsx");
    const startPendingActionFx = extractSourceBetween(
      source,
      "private startPendingActionFx(payload: PendingWorldmapFxStartPayload): void",
      "private startPendingCreateArmyGhost(",
    );
    const createArmyGhostFlow = extractSourceBetween(
      source,
      "private startPendingCreateArmyGhost(",
      "private playPendingFxAtHex(",
    );

    expect(startPendingActionFx).toContain("this.startPendingCreateArmyGhost(payload)");
    expect(source).not.toContain("create-army-resource-");
    expect(createArmyGhostFlow).toContain("resolveCreateArmyEffectTargetHex");
    expect(createArmyGhostFlow).not.toContain("playPendingFxAtHex");
    expect(createArmyGhostFlow).toContain("this.armyManager.resolvePendingCreationGhostSource");
    expect(createArmyGhostFlow).toContain("this.arrivalGhostManager.upsertLocalArrivalGhost");
    expect(createArmyGhostFlow).toContain("resolveArrivalGhostVisualStyle");
  });

  it("guards async create-army ghost rendering after the pending key has cleared", () => {
    const source = readSource("worldmap.tsx");
    const renderPendingCreateArmyGhost = extractSourceBetween(
      source,
      "private async renderPendingCreateArmyGhost(",
      "private playPendingFxAtHex(",
    );

    expect(renderPendingCreateArmyGhost).toContain("this.pendingCreateArmyEffectsByKey.get(input.key)");
    expect(renderPendingCreateArmyGhost).toContain("pending.ghostEntityId !== input.ghostEntityId");
    expect(renderPendingCreateArmyGhost.indexOf("this.pendingCreateArmyEffectsByKey.get(input.key)")).toBeLessThan(
      renderPendingCreateArmyGhost.indexOf("this.arrivalGhostManager.upsertLocalArrivalGhost"),
    );
  });

  it("clears pending create-army ghosts with explicit lifecycle reasons", () => {
    const source = readSource("worldmap.tsx");
    const startPendingCreateArmyGhost = extractSourceBetween(
      source,
      "private startPendingCreateArmyGhost(",
      "private allocatePendingCreateArmyGhostId()",
    );
    const clearAllPendingActionFx = extractSourceBetween(
      source,
      "private clearAllPendingActionFx()",
      "private resolvePendingCreateArmyGhostOnArmyUpdate(",
    );
    const resolvePendingCreateArmyGhostOnArmyUpdate = extractSourceBetween(
      source,
      "private resolvePendingCreateArmyGhostOnArmyUpdate(",
      "private clearPendingCreateArmyGhostsForOccupiedTiles()",
    );
    const clearPendingCreateArmyGhostsForOccupiedTiles = extractSourceBetween(
      source,
      "private clearPendingCreateArmyGhostsForOccupiedTiles()",
      "private resolvePendingAttackFxOnBattleUpdate(",
    );

    expect(source).toContain('this.clearPendingActionFx(detail.key, "tx_failed")');
    expect(startPendingCreateArmyGhost).toContain('this.clearPendingActionFx(payload.key, "stale_timeout")');
    expect(clearAllPendingActionFx).toContain("...this.pendingCreateArmyEffectsByKey.keys()");
    expect(clearAllPendingActionFx).toContain('this.clearPendingActionFx(key, "scene_destroyed")');
    expect(resolvePendingCreateArmyGhostOnArmyUpdate).toContain("shouldClearPendingCreateArmyEffect");
    expect(resolvePendingCreateArmyGhostOnArmyUpdate).toContain("removed: Boolean(update.removed)");
    expect(resolvePendingCreateArmyGhostOnArmyUpdate).toContain('this.clearPendingActionFx(key, "arrived")');
    expect(resolvePendingCreateArmyGhostOnArmyUpdate).toContain("this.clearPendingCreateArmyGhostsForOccupiedTiles()");
    expect(clearPendingCreateArmyGhostsForOccupiedTiles).toContain(
      "this.armyHexes.get(pending.targetHex.col)?.get(pending.targetHex.row)",
    );
    expect(clearPendingCreateArmyGhostsForOccupiedTiles).toContain('this.clearPendingActionFx(key, "arrived")');
  });
});
