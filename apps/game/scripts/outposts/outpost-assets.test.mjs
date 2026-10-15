import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

it.each(["camp", "village", "stragglers", "shrine", "well"])(
  "delivers %s inside the landmark budget with instancing and ownership metadata intact",
  (asset) => {
    const path = fileURLToPath(new URL(`../../public/models/outposts/${asset}.glb`, import.meta.url));
    const verifier = fileURLToPath(new URL("verify-outpost.mjs", import.meta.url));
    const result = JSON.parse(execFileSync(process.execPath, [verifier, path], { encoding: "utf8" }));
    expect(result.path).toBe(path);
    expect(result.bounds.min[1]).toBeLessThanOrEqual(0);
    expect(result.bounds.max[1]).toBeGreaterThan(0.5);
  },
);
