import type { IconMeaning } from "@/ui/design-system/icon";
import type { AspectId } from "@bibliothecadao/types";

export type ThemedHeadlineType =
  | "realm-fall"
  | "hyper-capture"
  | "elimination"
  | "game-start"
  | "five-min-warning"
  | "t3-building";

/**
 * A piece of a headline's line: words, or a player by account. A player is named where the line is drawn
 * (HeadlineLine), so a name identity has not answered yet waits there; a line never holds a name baked when its event
 * landed, which would keep the account's stand-in.
 */
export type HeadlinePart = string | { player: bigint };

interface HeadlineFacts {
  id: string;
  title: string;
  description: readonly HeadlinePart[];
  location?: { x: number; y: number; entityId: number };
  timestamp: number;
}

export type ThemedHeadline = HeadlineFacts & { type: ThemedHeadlineType; icon: ThemedHeadlineType };

export type Headline =
  | ThemedHeadline
  | (HeadlineFacts & {
      type: "deep-capture";
      icon: "deep-capture";
      look: { icon: IconMeaning; eyebrow: string; tone?: "bad"; aspect: AspectId };
    });

export const HEADLINE_DISPLAY_MS = 8_000;
