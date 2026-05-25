export type HeadlineType =
  | "realm-fall"
  | "hyper-capture"
  | "elimination"
  | "game-end"
  | "five-min-warning"
  | "first-t2-army"
  | "first-t3-army";

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
export const RECENT_HEADLINE_WINDOW_MS = 20_000;
