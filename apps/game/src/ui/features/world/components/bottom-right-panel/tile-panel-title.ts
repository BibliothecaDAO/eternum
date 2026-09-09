import { Position } from "@bibliothecadao/eternum";
import type { HexPosition } from "@bibliothecadao/types";

export function formatTilePanelTitle(label: string, hex: HexPosition): string {
  const { x, y } = new Position({ x: hex.col, y: hex.row }).getNormalized();
  return `${label} · (${x}, ${y})`;
}
