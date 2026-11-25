import { CanvasTexture } from "three";

export function createCanvasTexture(
  width: number,
  height: number,
): { texture: CanvasTexture; context: CanvasRenderingContext2D | null } {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  return { texture: new CanvasTexture(canvas), context };
}
