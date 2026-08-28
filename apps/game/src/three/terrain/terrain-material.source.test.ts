import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./terrain-material.ts", import.meta.url), "utf8");

describe("terrain material fidelity", () => {
  it("keeps one shared four-sample material after CPU-authored macro and shoreline treatment", () => {
    expect(source).not.toContain("mx_noise_float");
    expect(source.match(/texture\(textures\./g)).toHaveLength(4);
  });
});
