// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("PlayView dashboard play preloading", () => {
  it("preloads the shared play route and dashboard assets when the dashboard mounts", () => {
    const source = readSource("src/ui/features/landing/views/play-view.tsx");

    expect(source).toContain("primeGameEntry");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain('primeGameEntry("dashboard");');
  });
});
