// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("bootstrap hard-reload regression", () => {
  it("does not trigger a browser reload during bootstrap", () => {
    const source = readFileSync(resolve(process.cwd(), "src/init/bootstrap.tsx"), "utf8");

    expect(source).not.toContain("window.location.reload()");
  });

  it("does not trigger a browser reload when world selection changes chain", () => {
    const source = readFileSync(resolve(process.cwd(), "src/runtime/world/ensure-with-ui.ts"), "utf8");

    expect(source).not.toContain("window.location.reload()");
  });
});
