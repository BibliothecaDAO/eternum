import { TransactionType } from "@bibliothecadao/provider";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager, Position } from "@bibliothecadao/eternum";
import { useAccountAddress } from "@/hooks/store/use-account-store";
import type { PointsGrants } from "@/ui/features/world/hud/points-goal";
import { type ReactNode, useMemo } from "react";
import type { HeadlineType } from "../news-headlines/headline-types";
import { extractRoleLabel, findSegmentValue, parsePresentationDescription } from "../story-events/story-event-utils";
import { transactionStatusLine, transferRowLabel } from "./event-feed-rows";
import { formatClockTime } from "@bibliothecadao/eternum";
import { type ImportantFeedRow } from "./important-feed-rows";
import { useStoryOpener } from "./story-feed-row";
import { lostArmyLine, sendOutcome, storyOutcome } from "./row-outcomes";

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

/** One feed row, quick feed or log: icon, one line of text, the time; a row with a place flies the camera. */
/** One row of the feed: a story opens where it happened (its army for an opened crate), any other row flies to its place. */
export const FeedRowLine = ({ row }: { row: ImportantFeedRow }) =>
  row.kind === "story" ? <StoryRowLine row={row} /> : <PlacedRowLine row={row} />;

const StoryRowLine = ({ row }: { row: Extract<ImportantFeedRow, { kind: "story" }> }) => (
  <RowLine row={row} open={useStoryOpener(row.event)} />
);

const PlacedRowLine = ({ row }: { row: ImportantFeedRow }) => {
  const target = feedRowPlace(row);
  const navigate = useNavigateToMapView();
  return <RowLine row={row} open={target ? () => navigate(target) : null} />;
};

/**
 * The row itself: its words never cut to one line, so a sentence keeps where things went, and whole on hover. A
 * headline (the game's start and what scores, an announcement) is never cut.
 */
const RowLine = ({ row, open }: { row: ImportantFeedRow; open: (() => void) | null }) => {
  const { icon, text } = summarizeFeedRow(row, useOutcomeContext());
  const whole = row.kind === "headline";
  const content = (
    <>
      <span className={FEED_ROW_ICON_COLUMN_CLASS}>{icon}</span>
      <span
        className={cn("min-w-0 flex-1 break-words text-left", !whole && "line-clamp-2")}
        data-tip={whole ? undefined : text}
      >
        {text}
      </span>
      <span className="ml-auto shrink-0 text-right tabular-nums text-gold/50">{formatClockTime(row.at)}</span>
    </>
  );
  if (!open) {
    return <div className={FEED_ROW_CLASS}>{content}</div>;
  }
  return (
    <button
      type="button"
      onClick={open}
      className={cn(FEED_ROW_CLASS, "font-sans normal-case tracking-normal hover:bg-black/70")}
    >
      {content}
    </button>
  );
};

/** Where a row's camera flies: a headline's or a notice's place. */
function feedRowPlace(row: ImportantFeedRow): Position | null {
  if (row.kind === "headline") {
    const { location } = row.headline;
    return location ? Position.fromContract({ x: location.x, y: location.y }) : null;
  }
  if (row.kind === "notice") {
    return row.notice.location ? Position.fromContract(row.notice.location) : null;
  }
  return null;
}

/** What a row's outcome is read against: the game's points grants (read by a scoring row), and its viewer. */
interface OutcomeContext {
  grants: () => PointsGrants;
  viewer: string | null;
}

const readGrants = () => configManager.getVictoryPointGrants();

const useOutcomeContext = (): OutcomeContext => {
  const viewer = useAccountAddress();
  return useMemo(() => ({ grants: readGrants, viewer: viewer === null ? null : `0x${viewer.toString(16)}` }), [viewer]);
};

function summarizeFeedRow(row: ImportantFeedRow, context: OutcomeContext): { icon: ReactNode; text: string } {
  if (row.kind === "headline") {
    return { icon: <HeadlineIcon type={row.headline.type} />, text: row.headline.description };
  }
  if (row.kind === "story") return { icon: <StoryIcon story={row.event.story} />, text: summarizeStory(row, context) };
  if (row.kind === "transaction") {
    const { transaction } = row;
    const failed = transaction.status === "reverted" || transaction.status === "not_sent";
    const Icon =
      transaction.type === TransactionType.SEND
        ? "transfer"
        : failed
          ? ("warning" as const)
          : transaction.status === "success"
            ? ("check" as const)
            : ("hourglass" as const);
    return {
      icon: <SemanticIcon name={Icon} className={cn("h-4 w-4 shrink-0", failed && "text-danger")} />,
      text:
        sendOutcome(transaction, context.grants) ??
        `${transferRowLabel(row) ?? transaction.description} · ${transactionStatusLine(transaction)}`,
    };
  }
  const Icon =
    row.notice.kind === "error" || row.notice.kind === "warning"
      ? ("warning" as const)
      : row.notice.kind === "success"
        ? ("check" as const)
        : ("info" as const);
  return { icon: <SemanticIcon name={Icon} className="h-4 w-4 shrink-0" />, text: row.notice.title };
}

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

/** A story's line with what came of it: what an explore found, a crate's or a capture's points, the army a fight cost. */
function summarizeStory(row: Extract<ImportantFeedRow, { kind: "story" }>, context: OutcomeContext): string {
  const { event } = row;
  if (event.story !== "BattleEvent") return storyOutcome(event, context.grants) ?? event.presentation.title;
  const description = event.presentation.description;
  const outcome = findSegmentValue(parsePresentationDescription(description), (label) => label === "Outcome");
  const sides = `${extractRoleLabel(description, "Attacker")} vs ${extractRoleLabel(description, "Defender")}`;
  // The player's own loss leads: who won is then plain, and the army it cost is what they need to read.
  const lost = lostArmyLine(event.storyPayload, context.viewer);
  if (lost) return `${lost} · ${sides}`;
  return outcome ? `${sides} · ${outcome}` : sides;
}
