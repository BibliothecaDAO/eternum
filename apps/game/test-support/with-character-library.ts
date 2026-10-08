import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { vi } from "vitest";

import { ProceduralCharacterLibrary } from "../src/three/characters/procedural-character-assets";
import type { LoadedProceduralCharacterAssetTemplate } from "../src/three/characters/procedural-character-assets";
import { parseTextureFreeGlb } from "./parse-texture-free-glb";

/**
 * Runs `run` with a library of the real public GLBs, texture-free, loaded through the production loader function.
 * The caller restores the mocks (`vi.restoreAllMocks`, `vi.unstubAllGlobals`) after each test.
 */
export async function withCharacterLibrary(
  source: {
    loadTemplates: () => Promise<LoadedProceduralCharacterAssetTemplate[]>;
    urls: readonly string[];
  },
  run: (library: ProceduralCharacterLibrary) => void,
): Promise<void> {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const gltfs = new Map<string, GLTF>();
  for (const url of source.urls) gltfs.set(url, await parseTextureFreeGlb(url));
  vi.spyOn(GLTFLoader.prototype, "loadAsync").mockImplementation(async (url) => {
    const gltf = gltfs.get(String(url));
    if (!gltf) throw new Error(`Unexpected character asset: ${String(url)}`);
    return gltf;
  });
  const library = new ProceduralCharacterLibrary(await source.loadTemplates());
  try {
    run(library);
  } finally {
    library.dispose();
  }
}
