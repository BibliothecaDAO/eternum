import { ClampToEdgeWrapping, DataTexture, LinearFilter, SRGBColorSpace } from "three";
import { texture } from "three/tsl";
import { loadKtx2Texture } from "../utils/utils";

export const WEATHER_SPRITE_SHEETS = {
  lightning: {
    url: "/textures/weather/lightning-bolt.ktx2",
    columns: 8,
    rows: 8,
    frames: 16,
    frameMs: 50,
    variants: 4,
  },
  flash: { url: "/textures/weather/lightning-ground-flash.ktx2", columns: 4, rows: 4, frames: 16, frameMs: 50 },
  drops: { url: "/textures/weather/rain-drops.ktx2", columns: 4, rows: 4, frames: 16, frameMs: 50 },
  splashes: { url: "/textures/weather/rain-splashes.ktx2", columns: 4, rows: 4, frames: 16, frameMs: 50 },
} as const;
type SpriteSheet = (typeof WEATHER_SPRITE_SHEETS)[keyof typeof WEATHER_SPRITE_SHEETS];

export function spriteSheetFrame(sheet: SpriteSheet, elapsedMs: number, loop: boolean): number | null {
  const frame = Math.floor(Math.max(0, elapsedMs) / sheet.frameMs);
  return loop ? frame % sheet.frames : frame < sheet.frames ? frame : null;
}

/** Sheets are packed left to right from the top; texture offsets start at the bottom. */
export function spriteSheetOffset(sheet: SpriteSheet, frame: number): { x: number; y: number } {
  return { x: (frame % sheet.columns) / sheet.columns, y: 1 - (Math.floor(frame / sheet.columns) + 1) / sheet.rows };
}

const loadedSheets = new Map<string, ReturnType<typeof texture>>();

/** Every scene and lab shares one GPU copy per sheet for the life of the page; nobody disposes them. */
export function loadWeatherSpriteSheet(sheet: SpriteSheet): ReturnType<typeof texture> {
  const loaded = loadedSheets.get(sheet.url);
  if (loaded) return loaded;
  // Keep effects transparent while the shared worker transcodes the GPU-compressed sheet.
  const placeholder = new DataTexture(new Uint8Array(4), 1, 1);
  placeholder.colorSpace = SRGBColorSpace;
  placeholder.needsUpdate = true;
  const node = texture(placeholder);
  loadedSheets.set(sheet.url, node);
  void loadKtx2Texture(sheet.url)
    .then((loadedTexture) => {
      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.minFilter = loadedTexture.magFilter = LinearFilter;
      loadedTexture.generateMipmaps = false;
      loadedTexture.wrapS = loadedTexture.wrapT = ClampToEdgeWrapping;
      // Sample nodes retain this reference, including on already-created strikes.
      node.value = loadedTexture;
      placeholder.dispose();
    })
    .catch((error: unknown) => console.error(`[Weather] Failed to load sprite sheet ${sheet.url}`, error));
  return node;
}
