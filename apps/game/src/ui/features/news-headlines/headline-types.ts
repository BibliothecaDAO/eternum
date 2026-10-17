export type HeadlineType =
  | "realm-fall"
  | "hyper-capture"
  | "elimination"
  | "game-end"
  | "game-start"
  | "five-min-warning"
  | "t3-building";

export interface Headline {
  id: string;
  type: HeadlineType;
  title: string;
  description: string;
  icon: HeadlineType;
  location?: { x: number; y: number; entityId: number };
  timestamp: number;
}

export const HEADLINE_DISPLAY_MS = 8_000;
