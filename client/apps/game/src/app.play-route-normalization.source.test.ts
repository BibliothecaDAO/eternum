// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App play-route normalization", () => {
  it("only normalizes direct play routes while the boot overlay still owns entry handoff", () => {
    const source = readSource("src/app.tsx");

    expect(source).toContain("normalizePlayBootLocation");
    expect(source).toContain("const showBlankOverlay = useUIStore((state) => state.showBlankOverlay);");
    expect(source).toContain(
      "const normalizedBootHref = showBlankOverlay ? normalizePlayBootLocation(location) : null;",
    );
  });
});
