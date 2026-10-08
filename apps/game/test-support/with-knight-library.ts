import { loadT1KnightDefaultCharacterAssetTemplates } from "../src/three/characters/t1-knight-default-character-assets";
import type { ProceduralCharacterLibrary } from "../src/three/characters/procedural-character-assets";
import { withCharacterLibrary } from "./with-character-library";

export const KNIGHT_MODEL_PREFIX = "/models/characters/t1-knight-default/";

/** The real near and mid Knight skins; the caller restores mocks after each test. */
export function withKnightLibrary(run: (library: ProceduralCharacterLibrary) => void): Promise<void> {
  return withCharacterLibrary(
    {
      loadTemplates: loadT1KnightDefaultCharacterAssetTemplates,
      urls: ["near/skin.glb", "mid/skin.glb"].map((file) => KNIGHT_MODEL_PREFIX + file),
    },
    run,
  );
}
