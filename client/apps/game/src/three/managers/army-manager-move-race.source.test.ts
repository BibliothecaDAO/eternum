// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

const extractMethodBody = (source: string, signature: string): string => {
  const signatureIndex = source.indexOf(signature);
  if (signatureIndex < 0) {
    throw new Error(`method signature not found: ${signature}`);
  }

  const bodyStart = source.indexOf("{", signatureIndex);
  if (bodyStart < 0) {
    throw new Error(`opening brace not found for: ${signature}`);
  }

  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(signatureIndex, i + 1);
      }
    }
  }

  throw new Error(`closing brace not found for: ${signature}`);
};

describe("ArmyManager.moveArmy race guard", () => {
  it("claims the destination in armies Map synchronously before any await", () => {
    const source = readSource("src/three/managers/army-manager.ts");
    // Brace-balanced body extraction survives future growth of moveArmy so the
    // test doesn't silently skip the findPath await by running off the end of
    // a fixed-size window.
    const methodBody = extractMethodBody(source, "public async moveArmy(entityId: ID, hexCoords: Position)");

    const claimIndex = methodBody.indexOf("this.armies.set(entityId, { ...armyData, hexCoords })");
    const findPathAwaitIndex = methodBody.indexOf("await gameWorkerManager.findPath");

    expect(claimIndex).toBeGreaterThan(-1);
    expect(findPathAwaitIndex).toBeGreaterThan(-1);
    // Regression guard: moving this set below the findPath await reintroduces
    // the optimistic ↔ authoritative moveArmy ping-pong because a racing
    // second call sees the stale source position and runs a second animation
    // that snaps the in-flight instance back to path[0] (source).
    expect(claimIndex).toBeLessThan(findPathAwaitIndex);

    // Regression guard against silently reintroducing the post-await set in
    // addition to the pre-await claim — two sets would let a concurrent
    // moveArmy observe the old armyData between awaits.
    const claimRegex = /this\.armies\.set\(entityId, \{ \.\.\.armyData, hexCoords \}\)/g;
    const claimMatches = methodBody.match(claimRegex) ?? [];
    expect(claimMatches).toHaveLength(1);
  });
});
