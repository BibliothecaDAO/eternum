import { storyMeaning } from "@/ui/design-system/domain-icon-meaning";
import type { IconMeaning } from "@/ui/design-system/icon";
import { openOnMap } from "@/play/navigation/open-place";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { HudEventRow } from "@/ui/design-system/kit/hud-elements";
import { Position } from "@bibliothecadao/eternum";
import { formatClockTime } from "@bibliothecadao/types";
import type { HeadlineType } from "../news-headlines/headline-types";
import { useStoryOpener } from "./story-feed-row";
import type { ReactNode } from "react";

const HEADLINE_ICONS: Record<HeadlineType, IconMeaning> = {
  "realm-fall": "realm",
  "hyper-capture": "hyperstructure",
  elimination: "skull",
  "game-start": "play",
  "game-end": "victory",
  "five-min-warning": "hourglass",
  "t3-building": "build",
};

/** A clock milestone's painting. */
export const headlineIcon = (type: HeadlineType): IconMeaning => HEADLINE_ICONS[type];

/**
 * One story's row, in the strip or the Log: its kind's painting, the Log's own sentence for it (with what came of it),
 * and its time, in gold when it is the player's own among the world's; it opens where the story happened (its army,
 * for an opened crate).
 */
export const FeedRowLine = ({ event, own = false }: { event: ProcessedStoryEvent; own?: boolean }) => {
  const open = useStoryOpener(event);
  const text = event.presentation.title;
  return (
    <HudEventRow
      time={formatClockTime(event.timestampMs / 1000)}
      icon={storyMeaning(event.story)}
      onOpen={open ?? undefined}
    >
      {own ? <span className="text-hud-gold">{text}</span> : text}
    </HudEventRow>
  );
};

/**
 * A toast in the strip, the client's own and never a story: a notice (a refusal, a warning) in its tone, or a milestone
 * of the game's clock, whole however long; one with a place flies the camera there.
 */
export const ToastRow = ({
  icon,
  tone,
  text,
  place,
}: {
  icon: IconMeaning;
  tone?: "good" | "bad" | "warn";
  text: ReactNode;
  place: { x: number; y: number } | null;
}) => {
  return (
    <HudEventRow
      icon={icon}
      tone={tone}
      onOpen={place ? () => openOnMap(Position.fromContract(place), "tile") : undefined}
    >
      {text}
    </HudEventRow>
  );
};
