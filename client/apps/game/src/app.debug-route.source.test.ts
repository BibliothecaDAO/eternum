// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App debug route wiring", () => {
  it("mounts the Three.js chunk debug route outside the authenticated play flow", () => {
    const source = readSource("src/app.tsx");

    expect(source).toContain("DebugThreeChunkView");
    expect(source).toContain('path="/debug/three-chunks"');
    expect(source).toContain('<Route path="/debug/three-chunks" element={<DebugRouteShell />} />');
    expect(source).toContain('<Route path="*" element={<GameClientRouteShell />} />');
    expect(source).not.toContain("<StarknetProvider>");
    expect(source).not.toContain("../env");
    expect(source).not.toContain('path="/play/debug');

    const mainSource = readSource("src/main.tsx");

    expect(mainSource).not.toContain("../env");

    const debugViewSource = readSource("src/ui/features/debug/three-chunk-debug-view.tsx");

    expect(debugViewSource).toContain('useBootDocumentState("app-ready", "three_chunk_debug_ready")');
  });
});
