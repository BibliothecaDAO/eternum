export interface HexCoord {
  q: number;
  r: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

/** 6 hex directions for pointy-top orientation */
export type HexDirection = 0 | 1 | 2 | 3 | 4 | 5;

export interface FeatureHexData {
  coord: HexCoord;
  type: "game" | "lore" | "agent" | "token" | "community";
  symbol: string;
  label: string;
  description: string;
  link?: string;
}

export interface AgentData {
  id: number;
  coord: HexCoord;
  targetCoord: HexCoord;
  pixelPos: PixelCoord;
  phrase: string;
  glyph: string;
}

export interface EnemyData {
  id: number;
  coord: HexCoord;
  startCoord: HexCoord;
  targetCoord: HexCoord;
  pixelPos: PixelCoord;
}
