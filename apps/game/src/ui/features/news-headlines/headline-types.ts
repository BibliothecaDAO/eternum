export type HeadlineType =
  | "realm-fall"
  | "hyper-capture"
  | "elimination"
  | "game-end"
  | "game-start"
  | "five-min-warning"
  | "t3-building";

/**
 * A piece of a headline's line: words, or a player by account. A player is named where the line is drawn
 * (HeadlineLine), so a name identity has not answered yet waits there; a line never holds a name baked when its event
 * landed, which would keep the account's stand-in.
 */
export type HeadlinePart = string | { player: bigint };

export interface Headline {
  id: string;
  type: HeadlineType;
  title: string;
  description: readonly HeadlinePart[];
  icon: HeadlineType;
  location?: { x: number; y: number; entityId: number };
  timestamp: number;
}

export const HEADLINE_DISPLAY_MS = 8_000;
