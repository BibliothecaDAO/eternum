// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readClientSource = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), "src/three", relativePath), "utf8");

describe("render freeze attribution", () => {
  it("attributes hexception setup and deferred grid commits separately", () => {
    const source = readClientSource("scenes/hexception.tsx");

    expect(source).toContain('runWithFrameWorkOwner("scene:hexception:setup"');
    expect(source).toContain('runWithFrameWorkOwner("scene:hexception:grid", commitGrid)');
  });

  it("attributes each synchronous worldmap zoom-band workload", () => {
    const sources = [
      readClientSource("scenes/worldmap.tsx"),
      readClientSource("managers/army-manager.ts"),
      readClientSource("managers/structure-manager.ts"),
      readClientSource("managers/chest-manager.ts"),
    ].join("\n");

    expect(sources).toContain('runWithFrameWorkOwner("zoom:interaction-overlays"');
    expect(sources).toContain('runWithFrameWorkOwner("zoom:terrain-detail"');
    expect(sources).toContain('runWithFrameWorkOwner("zoom:worldmap-shadows"');
    expect(sources).toContain('runWithFrameWorkOwner("zoom:army-presentation"');
    expect(sources).toContain('runWithFrameWorkOwner("zoom:structure-presentation"');
    expect(sources).toContain('runWithFrameWorkOwner("zoom:chest-presentation"');
  });
});
