import { loadQuaterniusCharacterAssetTemplate } from "../src/three/characters/quaternius-character-assets";

export async function loadQuaterniusCharacterAssetTemplates() {
  const base = await loadQuaterniusCharacterAssetTemplate("base");
  return [
    base,
    await loadQuaterniusCharacterAssetTemplate("peasant", base),
    await loadQuaterniusCharacterAssetTemplate("ranger", base),
  ];
}
