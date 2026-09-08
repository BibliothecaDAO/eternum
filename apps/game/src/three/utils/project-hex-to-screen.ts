import type { Camera } from "three";
import type { HexPosition } from "@bibliothecadao/types";
import { getWorldPositionForHex } from "./utils";

/** Project either scene's normalized hex onto the shared map canvas. */
export function projectHexToScreen(hex: HexPosition, camera: Camera): { x: number; y: number } {
  const canvas = document.getElementById("main-canvas");
  if (!canvas) throw new Error("Map canvas is missing");
  const rect = canvas.getBoundingClientRect();
  const point = getWorldPositionForHex(hex).project(camera);
  return { x: rect.left + ((point.x + 1) * rect.width) / 2, y: rect.top + ((1 - point.y) * rect.height) / 2 };
}
