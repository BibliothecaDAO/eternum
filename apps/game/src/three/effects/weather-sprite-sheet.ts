import { ClampToEdgeWrapping, LinearFilter, SRGBColorSpace, TextureLoader, type Texture } from "three";

export const WEATHER_SPRITE_SHEETS = {
  lightning: { url: "/textures/weather/lightning-bolt.png", columns: 8, rows: 8, frames: 16, frameMs: 50, variants: 4 },
  flash: { url: "/textures/weather/lightning-ground-flash.png", columns: 4, rows: 4, frames: 16, frameMs: 50 },
  drops: { url: "/textures/weather/rain-drops.png", columns: 4, rows: 4, frames: 16, frameMs: 50 },
  splashes: { url: "/textures/weather/rain-splashes.png", columns: 4, rows: 4, frames: 16, frameMs: 50 },
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

const loadedSheets = new Map<string, Texture>();

/** Every scene and lab shares one GPU copy per sheet for the life of the page; nobody disposes them. */
export function loadWeatherSpriteSheet(sheet: SpriteSheet): Texture {
  const loaded = loadedSheets.get(sheet.url);
  if (loaded) return loaded;
  const texture = new TextureLoader().load(sheet.url);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
  loadedSheets.set(sheet.url, texture);
  return texture;
}
