// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("bootstrap hard-reload regression", () => {
  it("does not trigger a browser reload during bootstrap", () => {
    const source = readFileSync(resolve(process.cwd(), "src/init/bootstrap.tsx"), "utf8");

    expect(source).not.toContain("window.location.reload()");
  });

  it("does not trigger a browser reload when redirecting legacy world-selection flows back to landing", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/world-selector/index.tsx"), "utf8");

    expect(source).not.toContain("window.location.reload()");
  });
});
