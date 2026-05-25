// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("Worldmap ready signal", () => {
  it("dispatches the shared worldmap ready event after setup completes", () => {
    const source = readSource("src/three/scenes/worldmap.tsx");

    expect(source).toContain("WORLDMAP_SCENE_READY_EVENT");
    expect(source).toContain("onInitialSetupComplete");
    expect(source).toContain("onResumeComplete");
    expect(source).toContain("window.dispatchEvent(new Event(WORLDMAP_SCENE_READY_EVENT))");
  });
});
