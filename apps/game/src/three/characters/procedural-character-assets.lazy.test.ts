// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { parseTextureFreeGlb } from "../../../test-support/parse-texture-free-glb";
import { loadProceduralCharacterLibrary } from "./procedural-character-assets";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("loads only the selected outfit and its shared head, retaining them across tier switches", async () => {
  vi.stubGlobal("ProgressEvent", class extends Event {});
  const load = vi
    .spyOn(GLTFLoader.prototype, "loadAsync")
    .mockImplementation((url) => parseTextureFreeGlb(String(url)));
  const library = await loadProceduralCharacterLibrary();
  const base = { appearanceId: "modular-fantasy", tier: 1, renderDetail: "hero" } as const;
  try {
    expect(load).not.toHaveBeenCalled();
    expect(library.isReady(base)).toBe(false);
    await library.prepare(base);
    expect(library.isReady(base)).toBe(true);
    expect(load.mock.calls.map(([url]) => url)).toEqual(["/models/characters/quaternius/base-male.glb"]);
    const ranger = { ...base, tier: 3 } as const;
    await Promise.all([library.prepare(ranger), library.prepare(ranger)]);
    expect(library.isReady(ranger)).toBe(true);
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      "/models/characters/quaternius/base-male.glb",
      "/models/characters/quaternius/ranger-male.glb",
    ]);
    expect(
      library.instantiate("modular-fantasy", 3).gltf.scene.getObjectByName("UniversalHead_SuperHero_Male"),
    ).toBeDefined();
    await library.prepare(base);
    expect(load).toHaveBeenCalledTimes(2);
    expect(library.isReady({ ...base, tier: 2 })).toBe(false);
  } finally {
    library.dispose();
  }
});
