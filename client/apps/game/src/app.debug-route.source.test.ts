// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("App debug route wiring", () => {
  it("mounts the Three.js chunk debug route outside the authenticated play flow", () => {
    const source = readSource("src/app.tsx");

    expect(source).toContain("DebugThreeChunkView");
    expect(source).toContain("DebugProceduralCharacterGymView");
    expect(source).toContain("DebugProceduralCharacterBenchmarkView");
    expect(source).toContain("DebugTerrainPropView");
    expect(source).toContain("DebugProceduralTerrainView");
    expect(source).toContain("DebugProceduralTerrainBenchmarkView");
    expect(source).toContain('path="/debug/three-chunks"');
    expect(source).toContain('path="/debug/procedural-characters"');
    expect(source).toContain('path="/debug/procedural-character-benchmark"');
    expect(source).toContain('path="/debug/terrain-props"');
    expect(source).toContain('path="/debug/procedural-terrain"');
    expect(source).toContain('path="/debug/procedural-terrain-benchmark"');
    expect(source).toContain("<DebugThreeChunkView />");
    expect(source).toContain("<DebugProceduralCharacterGymView />");
    expect(source).toContain("<DebugProceduralCharacterBenchmarkView />");
    expect(source).toContain("<DebugTerrainPropView />");
    expect(source).toContain("<DebugProceduralTerrainView />");
    expect(source).toContain("<DebugProceduralTerrainBenchmarkView />");
    expect(source).toContain('<Route path="*" element={<GameClientRouteShell />} />');
    expect(source).not.toContain("<StarknetProvider>");
    expect(source).not.toContain("../env");
    expect(source).not.toContain('path="/play/debug');

    const mainSource = readSource("src/main.tsx");

    expect(mainSource).not.toContain("../env");

    const debugViewSource = readSource("src/ui/features/debug/three-chunk-debug-view.tsx");
    const characterGymSource = readSource("src/ui/features/debug/procedural-character-gym-view.tsx");
    const characterBenchmarkSource = readSource("src/ui/features/debug/procedural-character-benchmark-view.tsx");

    expect(debugViewSource).toContain('useBootDocumentState("app-ready", "three_chunk_debug_ready")');
    expect(characterGymSource).toContain('useBootDocumentState("app-ready", "procedural_character_gym_ready")');
    expect(characterGymSource).toContain('data-debug-route="procedural-characters"');
    expect(characterBenchmarkSource).toContain(
      'useBootDocumentState("app-ready", "procedural_character_benchmark_ready")',
    );
    expect(characterBenchmarkSource).toContain('data-debug-route="procedural-character-benchmark"');
  });
});
