import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("game border fallback styling", () => {
  it("keeps the bare border fallback in the game palette", () => {
    const source = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

    expect(source).toContain("@layer base");
    expect(source).toContain("border-color: rgba(223, 170, 84, 0.18);");
  });
});
