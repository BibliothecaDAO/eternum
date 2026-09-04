import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createWorld } from "@dojoengine/recs";
import { describe, expect, it } from "vitest";

import { defineContractComponents } from "./contract-components";

describe("defineContractComponents", () => {
  it("exposes the Blitz settlement model used by prize leaderboards", () => {
    const components = defineContractComponents(createWorld(), "s2");
    const blitzSettlement = (components as Record<string, any>).BlitzSettlement;

    expect(blitzSettlement).toBeDefined();
    expect(blitzSettlement.metadata).toMatchObject({
      namespace: "s2",
      name: "BlitzSettlement",
      types: ["u32", "ContractAddress", "Span<u32>"],
    });
    expect(Object.keys(blitzSettlement.schema)).toEqual(["game_id", "player", "structure_ids"]);
  });

  it("is byte-identical to a fresh generation from the Madara manifest", () => {
    const packageRoot = path.resolve(import.meta.dirname, "../..");
    const outputDirectory = mkdtempSync(path.join(tmpdir(), "eternum-contract-components-"));
    const generatedPath = path.join(outputDirectory, "contract-components.ts");

    try {
      execFileSync("bun", [path.join(packageRoot, "scripts/generate-contract-components.ts")], {
        cwd: packageRoot,
        env: { ...process.env, CONTRACT_COMPONENTS_OUTPUT: generatedPath },
        stdio: "pipe",
      });

      const committed = readFileSync(path.join(packageRoot, "src/dojo/contract-components.ts"), "utf8");
      expect(readFileSync(generatedPath, "utf8")).toBe(committed);
    } finally {
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  });
});
