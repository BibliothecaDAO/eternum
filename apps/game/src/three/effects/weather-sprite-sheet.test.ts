import { expect, it, vi } from "vitest";
import { uv } from "three/tsl";
import { DataTexture, CompressedTexture, LinearFilter, SRGBColorSpace } from "three";
const loadKtx2Texture = vi.hoisted(() => vi.fn());
vi.mock("../utils/utils", () => ({ loadKtx2Texture }));
import {
  loadWeatherSpriteSheet,
  spriteSheetFrame,
  spriteSheetOffset,
  WEATHER_SPRITE_SHEETS,
} from "./weather-sprite-sheet";
it("steps frames every 50 ms and finishes a strike after all sixteen frames", () => {
  const sheet = WEATHER_SPRITE_SHEETS.lightning;
  expect(spriteSheetFrame(sheet, 49, false)).toBe(0);
  expect(spriteSheetFrame(sheet, 50, false)).toBe(1);
  expect(spriteSheetFrame(sheet, 799, false)).toBe(15);
  expect(spriteSheetFrame(sheet, 800, false)).toBeNull();
  expect(spriteSheetFrame(WEATHER_SPRITE_SHEETS.drops, 850, true)).toBe(1);
});
it("samples the top-left first frame and advances across rows without bleeding into adjacent frames", () => {
  const sheet = WEATHER_SPRITE_SHEETS.flash;
  expect(spriteSheetOffset(sheet, 0)).toEqual({ x: 0, y: 0.75 });
  expect(spriteSheetOffset(sheet, 3)).toEqual({ x: 0.75, y: 0.75 });
  expect(spriteSheetOffset(sheet, 4)).toEqual({ x: 0, y: 0.5 });
  expect(spriteSheetOffset(sheet, 15)).toEqual({ x: 0.75, y: 0 });
});
it("shares compressed sheets and updates existing samples when worker decoding finishes", async () => {
  const decoded = new CompressedTexture([], 4, 4);
  loadKtx2Texture.mockResolvedValueOnce(decoded);
  const sheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.lightning);
  const placeholder = sheet.value as DataTexture;
  const dispose = vi.spyOn(placeholder, "dispose");
  const sample = sheet.sample(uv());
  expect(Array.from(placeholder.image.data!)).toEqual([0, 0, 0, 0]);
  expect(loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.lightning)).toBe(sheet);
  expect(loadKtx2Texture).toHaveBeenCalledTimes(1);
  await Promise.resolve();
  expect(sample.value).toBe(decoded);
  expect(decoded).toMatchObject({ colorSpace: SRGBColorSpace, minFilter: LinearFilter, generateMipmaps: false });
  expect(dispose).toHaveBeenCalledTimes(1);
});
it("reports a failed sheet load and leaves its sample transparent", async () => {
  const failure = new Error("transcode failed");
  loadKtx2Texture.mockRejectedValueOnce(failure);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const sheet = loadWeatherSpriteSheet(WEATHER_SPRITE_SHEETS.flash);
  await vi.waitFor(() =>
    expect(error).toHaveBeenCalledWith(expect.stringContaining("lightning-ground-flash.ktx2"), failure),
  );
  expect(Array.from((sheet.value as DataTexture).image.data!)).toEqual([0, 0, 0, 0]);
  error.mockRestore();
});
