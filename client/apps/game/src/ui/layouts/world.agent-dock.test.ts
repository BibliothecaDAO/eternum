// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("World layout agent dock integration", () => {
  it("renders a dedicated AgentDockHost in the HUD layer", () => {
    const source = readFileSync(resolve(process.cwd(), "src/ui/layouts/world.tsx"), "utf8");

    expect(source).toContain("AgentDockHost");
    expect(source).toContain("<AgentDockHost />");
  });
});
