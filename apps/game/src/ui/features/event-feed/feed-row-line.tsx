import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import type { ProcessedStoryEvent } from "@/hooks/store/use-story-events-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { formatClockTime, Position } from "@bibliothecadao/eternum";
import type { ReactNode } from "react";
import type { HeadlineType } from "../news-headlines/headline-types";
import { useStoryOpener } from "./story-feed-row";

/** One feed row in the Log button's translucent black, not the panels' surface: a fixed icon column, up to two lines
 *  of text (a row grows to fit them and never spills over the next), the time flush right. */
export const FEED_ROW_CLASS =
  "pointer-events-auto flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md bg-black/50 px-2.5 py-1 text-xs text-gold backdrop-blur-[2px]";
const FEED_ROW_ICON_COLUMN_CLASS = "flex w-4 shrink-0 items-center justify-center";

const HEADLINE_ICONS: Record<HeadlineType, IconMeaning> = {
  "realm-fall": "realm" as const,
  "hyper-capture": "hyperstructure" as const,
  elimination: "skull" as const,
  "game-start": "play" as const,
  "game-end": "victory" as const,
  "five-min-warning": "hourglass" as const,
  "t3-building": "build" as const,
};

export const HeadlineIcon = ({ type }: { type: HeadlineType }) => {
  const Icon = HEADLINE_ICONS[type];
  return <SemanticIcon name={Icon} className="h-4 w-4 shrink-0" />;
};

/**
 * One story's row, in the strip or the Log: its icon, the Log's own sentence for it (with what came of it), on up to two
 * lines and whole on hover, and its time; it opens where the story happened (its army, for an opened crate).
 */
export const FeedRowLine = ({ event }: { event: ProcessedStoryEvent }) => {
  const open = useStoryOpener(event);
  const text = event.presentation.title;
  const content = (
    <>
      <span className={FEED_ROW_ICON_COLUMN_CLASS}>
        <StoryIcon story={event.story} />
      </span>
      <span className="line-clamp-2 min-w-0 flex-1 break-words text-left" data-tip={text}>
        {text}
      </span>
      <span className="ml-auto shrink-0 text-right tabular-nums text-gold/50">
        {formatClockTime(event.timestampMs)}
      </span>
    </>
  );
  return open ? (
    <button
      type="button"
      onClick={open}
      className={cn(FEED_ROW_CLASS, "font-sans normal-case tracking-normal hover:bg-black/70")}
    >
      {content}
    </button>
  ) : (
    <div className={FEED_ROW_CLASS}>{content}</div>
  );
};

/**
 * A toast above the strip, the client's own and never a story: a notice (a refusal, a warning) or a milestone of the
 * game's clock, whole however long; one with a place flies the camera there.
 */
export const ToastRow = ({
  icon,
  text,
  place,
}: {
  icon: ReactNode;
  text: string;
  place: { x: number; y: number } | null;
}) => {
  const navigate = useNavigateToMapView();
  const content = (
    <>
      <span className={FEED_ROW_ICON_COLUMN_CLASS}>{icon}</span>
      <span className="min-w-0 flex-1 break-words text-left">{text}</span>
    </>
  );
  return place ? (
    <button
      type="button"
      aria-label="Notice"
      onClick={() => navigate(Position.fromContract(place))}
      className={cn(FEED_ROW_CLASS, "border border-gold/60 font-sans normal-case tracking-normal hover:bg-black/70")}
    >
      {content}
    </button>
  ) : (
    <div aria-label="Notice" className={cn(FEED_ROW_CLASS, "border border-gold/60")}>
      {content}
    </div>
  );
};

/** A fight's swords; a delivery's donkey; any other news of the player's realms, their castle. */
const StoryIcon = ({ story }: { story: string }) => {
  const Icon =
    story === "BattleEvent" || story === "RaidEvent"
      ? ("military" as const)
      : story === "ResourceReceiveArrivalStory"
        ? ("transfer" as const)
        : ("realm" as const);
  return <SemanticIcon name={Icon} className="h-4 w-4 shrink-0" />;
};
