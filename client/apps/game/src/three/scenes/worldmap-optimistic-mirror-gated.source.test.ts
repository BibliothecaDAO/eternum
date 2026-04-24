import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readSource(filename: string): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return readFileSync(resolve(currentDir, filename), "utf8");
}

// applyMovementPlan has four early-return paths (missing army, already at
// target, source drifted, no render slot). When any of those fires, no
// optimistic lock is written and no tween runs — but the tx_confirmed mirror
// still fires in the .then() continuation. Without gating, armyHexes[dest]
// gets pinned with nothing left to rewind it on discovery-revert or stale
// Torii replay, producing the "mesh at source, destination still selectable"
// desync. Two concurrent moves make this path statistically more likely
// because matrixIndex can flicker during the other unit's chunk work.
describe("Worldmap optimistic mirror gated on applyMovementPlan result", () => {
  it("applyMovementPlan returns Promise<boolean>", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "../managers/army-manager.ts"),
      "utf8",
    );

    expect(source).toMatch(
      /public async applyMovementPlan\(\s*plan: ArmyMovementPlan,\s*options: \{ optimistic: boolean \},?\s*\): Promise<boolean>/,
    );
  });

  it("every early-return path in applyMovementPlan returns false", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "../managers/army-manager.ts"),
      "utf8",
    );

    const methodStart = source.indexOf("public async applyMovementPlan(");
    expect(methodStart).toBeGreaterThan(0);
    const methodEnd = source.indexOf("\n  public ", methodStart + 20);
    expect(methodEnd).toBeGreaterThan(methodStart);
    const body = source.slice(methodStart, methodEnd);

    // Missing army data — ArmyManager lost the entry between plan and apply.
    expect(body).toMatch(/if \(!armyData\) return false/);
    // Already at target — redundant plan, nothing to animate.
    expect(body).toMatch(/=== targetNormalized\.x &&[\s\S]{0,80}=== targetNormalized\.y\) return false/);
    // Source drifted — stale plan, refuse to pin a wrong destination.
    expect(body).toMatch(/!== sourceNormalized\.x \|\|[\s\S]{0,80}!== sourceNormalized\.y\) return false/);
    // matrixIndex undefined — army not rendered, no tween, no lock.
    // Find the block after matrixIndex === undefined and confirm it ends with return false.
    const matrixStart = body.indexOf("matrixIndex === undefined");
    expect(matrixStart).toBeGreaterThan(0);
    const matrixBlock = body.slice(matrixStart, matrixStart + 800);
    expect(matrixBlock).toMatch(/return false;/);

    // Final return on the happy path must be true so the caller knows the
    // optimistic lock is registered and the mirror is safe to fire.
    expect(body).toMatch(/return true;/);
  });

  it("handleTransactionComplete gates the mirror on applyMovementPlan's return", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete = ");
    expect(handlerStart).toBeGreaterThan(0);
    const handlerEnd = source.indexOf("this.handleTransactionFailed = ", handlerStart);
    expect(handlerEnd).toBeGreaterThan(handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    // The .then receives a boolean and bails early when it's falsy.
    expect(handler).toMatch(/applyMovementPlan\(plan, \{ optimistic: true \}\)\.then\(\(planApplied\) => \{/);
    expect(handler).toMatch(/if \(!planApplied\)[\s\S]*?return;/);
    // The mirror and biome paint must live AFTER the guard, not before.
    const guardIdx = handler.search(/if \(!planApplied\)/);
    const mirrorIdx = handler.indexOf("this.updateArmyHexes(", guardIdx);
    const biomeIdx = handler.indexOf("Biome.getBiome(", guardIdx);
    expect(mirrorIdx).toBeGreaterThan(guardIdx);
    expect(biomeIdx).toBeGreaterThan(guardIdx);
  });

  it("emits optimistic_animation_skipped latency phase when the plan no-ops", () => {
    const source = readSource("worldmap.tsx");

    const handlerStart = source.indexOf("this.handleTransactionComplete = ");
    const handlerEnd = source.indexOf("this.handleTransactionFailed = ", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);

    // Observability: without this phase marker, the no-op path is invisible
    // in the latency trace and we can't confirm from logs which early-return
    // fired in production.
    expect(handler).toContain('"optimistic_animation_skipped"');
  });

  it("registers optimistic_animation_skipped in the latency phase union", () => {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(
      resolve(currentDir, "../../../../../../packages/core/src/systems/army-movement-latency-trace.ts"),
      "utf8",
    );
    expect(source).toContain('"optimistic_animation_skipped"');
  });
});
