// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("renderer debug control wiring", () => {
  it("lives with graphics settings instead of floating over the world", () => {
    expect(readSource("src/ui/modules/settings/settings.tsx")).toContain("<RendererDebugControl");
    expect(readSource("src/ui/layouts/world.tsx")).not.toContain("RendererDebugControl");
  });

  it("remains available while booting and after a bootstrap failure", () => {
    expect(readSource("src/ui/modules/boot-loader/boot-debug-panel.tsx")).toContain("<RendererDebugControl");
    expect(readSource("src/ui/layouts/play-route-bootstrap-error-screen.tsx")).toContain("<RendererDebugControl");
  });
});
