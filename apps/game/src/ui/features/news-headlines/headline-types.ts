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
  /** The action it tells when a story tells it too (a capture), so the two are one row. */
  action?: string;
  timestamp: number;
}

export const HEADLINE_DISPLAY_MS = 8_000;
