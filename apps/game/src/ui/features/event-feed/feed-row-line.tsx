import type { IconMeaning } from "@/ui/design-system/icon";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { HudEventRow } from "@/ui/design-system/kit/hud-elements";
import { Position } from "@bibliothecadao/eternum";
import { formatClockTime } from "@bibliothecadao/types";
import type { HeadlineType } from "../news-headlines/headline-types";
import { useStoryOpener } from "./story-feed-row";

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
 * whole on hover, and its time; it opens where the story happened (its army, for an opened crate).
 */
export const FeedRowLine = ({ event }: { event: ProcessedStoryEvent }) => {
  const open = useStoryOpener(event);
  const text = event.presentation.title;
  return (
    <HudEventRow
      time={formatClockTime(event.timestampMs / 1000)}
      icon={storyIcon(event.story)}
      tip={text}
      onOpen={open ?? undefined}
    >
      {text}
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
  text: string;
  place: { x: number; y: number } | null;
}) => {
  const navigate = useNavigateToMapView();
  return (
    <HudEventRow icon={icon} tone={tone} onOpen={place ? () => navigate(Position.fromContract(place)) : undefined}>
      {text}
    </HudEventRow>
  );
};

/** A fight's swords; a delivery's donkey; any other news of the player's realms, their castle. */
const storyIcon = (story: string): IconMeaning =>
  story === "BattleEvent" || story === "RaidEvent"
    ? "military"
    : story === "ResourceReceiveArrivalStory"
      ? "transfer"
      : "realm";
