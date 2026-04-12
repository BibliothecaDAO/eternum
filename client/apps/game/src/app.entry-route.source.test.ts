// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App entry route wiring", () => {
  it("mounts the route-owned game entry flow inside the landing layout", () => {
    const source = readSource("src/app.tsx");

    expect(source).toContain('path="enter/:chain/:world"');
    expect(source).toContain("<LandingEntryRoute />");
  });
});
