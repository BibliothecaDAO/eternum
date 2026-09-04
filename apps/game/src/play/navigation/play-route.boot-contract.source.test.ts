// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("play route boot contract", () => {
  it("supports map-first boot and resumeScene route params", () => {
    const source = readSource("src/play/navigation/play-route.ts");

    expect(source).toContain('export type PlayBootMode = "direct" | "map-first"');
    expect(source).toContain('searchParams.get("boot")');
    expect(source).toContain('searchParams.get("resumeScene")');
  });
});
