import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Landing home navigation factory tab", () => {
  it("includes a factory submenu item on home", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/features/landing/context/navigation-config.ts"), "utf8");

    expect(source).toContain('{ id: "factory", label: "FACTORY", tab: "factory" }');
  });
});
