import { expect, it } from "vitest";
import { spriteSheetFrame, spriteSheetOffset, WEATHER_SPRITE_SHEETS } from "./weather-sprite-sheet";
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
