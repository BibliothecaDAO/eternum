import { type Camera, Vector3 } from "three";
import type { HexPosition } from "@bibliothecadao/types";
import { HEX_HORIZONTAL_SPACING } from "./hex-lattice";
import { getWorldPositionForHex } from "./utils";

const EAST_EDGE = new Vector3(HEX_HORIZONTAL_SPACING / 2, 0, 0);

const mapCanvasRect = (): DOMRect => {
  const canvas = document.getElementById("main-canvas");
  if (!canvas) throw new Error("Map canvas is missing");
  return canvas.getBoundingClientRect();
};

const toPagePoint = (world: Vector3, camera: Camera, rect: DOMRect): { x: number; y: number } => {
  const point = world.project(camera);
  return { x: rect.left + ((point.x + 1) * rect.width) / 2, y: rect.top + ((1 - point.y) * rect.height) / 2 };
};

/** Project either scene's normalized hex onto the shared map canvas. */
export function projectHexToScreen(hex: HexPosition, camera: Camera): { x: number; y: number } {
  return toPagePoint(getWorldPositionForHex(hex), camera, mapCanvasRect());
}

export function projectHexEastEdgeToScreen(hex: HexPosition, camera: Camera): { x: number; y: number } {
  return toPagePoint(getWorldPositionForHex(hex).add(EAST_EDGE), camera, mapCanvasRect());
}
