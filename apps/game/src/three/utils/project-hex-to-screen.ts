import { Vector3, type Camera } from "three";
import type { HexPosition } from "@bibliothecadao/types";
import { getWorldPositionForHex } from "./utils";

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

export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The page box (px) that holds every one of these world points. */
export function projectPointsToScreen(points: Vector3[], camera: Camera): ScreenBox {
  const rect = mapCanvasRect();
  const onPage = points.map((point) => toPagePoint(point.clone(), camera, rect));
  const xs = onPage.map((point) => point.x);
  const ys = onPage.map((point) => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
}
