import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import OUTPOST_ASSETS from "./outpost-assets.json";

it("keeps shipped outpost deliveries and the runtime proof aligned with outpost-assets.json", () => {
  const deliveries = readdirSync(new URL("../../public/models/outposts/", import.meta.url)).filter((file) =>
    file.endsWith(".glb"),
  );
  for (const asset of OUTPOST_ASSETS) {
    expect(deliveries).toContain(`${asset}.glb`);
  }
  expect(deliveries).not.toContain("ruin.glb");
  expect(deliveries).not.toContain("shrine.glb");
  expect(deliveries).not.toContain("well.glb");

  const proofSource = readFileSync(new URL("prove-runtime.playwright.js", import.meta.url), "utf8");
  const expectedLiteral = JSON.stringify(OUTPOST_ASSETS).replaceAll(",", ", ");
  expect(proofSource).toContain(expectedLiteral);
});

it.each(OUTPOST_ASSETS)(
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
