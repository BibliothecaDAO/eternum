import { TransactionType } from "@bibliothecadao/provider";
import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import { getEntityName, getIsBlitz, structureMapPosition } from "@bibliothecadao/eternum";

import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { configManager, Position } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useNativeRow } from "@/hooks/helpers/use-native-facts";
import type { ReactNode } from "react";
import type { HeadlineType } from "../news-headlines/headline-types";
import { extractRoleLabel, findSegmentValue, parsePresentationDescription } from "../story-events/story-event-utils";
import { arrivalLabel, transactionStatusLine, transferRowLabel } from "./event-feed-rows";
import { formatClockTime } from "@bibliothecadao/eternum";
import { type ImportantFeedRow } from "./important-feed-rows";
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

/** One feed row, quick feed or log: icon, one line of text, the time; a row with a place flies the camera. */
/** One row of the feed: a story opens where it happened (its army for an opened crate), any other row flies to its place. */
export const FeedRowLine = ({ row }: { row: ImportantFeedRow }) =>
  row.kind === "story" ? <StoryRowLine row={row} /> : <PlacedRowLine row={row} />;

const StoryRowLine = ({ row }: { row: Extract<ImportantFeedRow, { kind: "story" }> }) => (
  <RowLine row={row} open={useStoryOpener(row.event)} recipient={null} />
);

const PlacedRowLine = ({ row }: { row: ImportantFeedRow }) => {
  const { target, recipient } = useFeedRowPlace(row);
  const navigate = useNavigateToMapView();
  return <RowLine row={row} open={target ? () => navigate(target) : null} recipient={recipient} />;
};

/** The row itself: its words never cut to one line, so a sentence keeps where things went; whole on hover. */
const RowLine = ({
  row,
  open,
  recipient,
}: {
  row: ImportantFeedRow;
  open: (() => void) | null;
  recipient: string | null;
}) => {
  const { icon, text } = summarizeFeedRow(row, recipient);
  const content = (
    <>
      <span className={FEED_ROW_ICON_COLUMN_CLASS}>{icon}</span>
      <span className="line-clamp-2 min-w-0 flex-1 break-words text-left" title={text}>
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

/** Where a row's camera flies, and whom it names: an arrival's structure, by its shared name. */
function useFeedRowPlace(row: ImportantFeedRow): { target: Position | null; recipient: string | null } {
  const {
    setup: { store },
  } = useGame();
  const structure = useNativeRow(
    "Structure",
    row.kind === "arrival" ? { game_id: configManager.getActiveGameId(), entity_id: row.structureEntityId } : undefined,
  );
  if (row.kind === "headline") {
    const { location } = row.headline;
    return { target: location ? Position.fromContract({ x: location.x, y: location.y }) : null, recipient: null };
  }
  if (row.kind === "arrival") {
    const site = structure && structureMapPosition(store, structure);
    return {
      target: site ? Position.fromContract(site) : null,
      recipient: getEntityName(row.structureEntityId, store, getIsBlitz()) ?? null,
    };
  }
  if (row.kind === "notice") {
    return { target: row.notice.location ? Position.fromContract(row.notice.location) : null, recipient: null };
  }
  return { target: null, recipient: null };
}

function summarizeFeedRow(row: ImportantFeedRow, recipient: string | null): { icon: ReactNode; text: string } {
  if (row.kind === "headline") {
    return { icon: <HeadlineIcon type={row.headline.type} />, text: row.headline.description };
  }
  if (row.kind === "story") return { icon: <StoryIcon story={row.event.story} />, text: summarizeStory(row) };
  if (row.kind === "arrival") {
    return {
      icon: <SemanticIcon name="transfer" className="h-4 w-4 shrink-0" />,
      text: recipient ? `${arrivalLabel(row)} · ${recipient}` : arrivalLabel(row),
    };
  }
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
      text: `${transferRowLabel(row) ?? transaction.description} · ${transactionStatusLine(transaction)}`,
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

function summarizeStory(row: Extract<ImportantFeedRow, { kind: "story" }>): string {
  const { event } = row;
  if (event.story !== "BattleEvent") return event.presentation.title;
  const description = event.presentation.description;
  const outcome = findSegmentValue(parsePresentationDescription(description), (label) => label === "Outcome");
  const sides = `${extractRoleLabel(description, "Attacker")} vs ${extractRoleLabel(description, "Defender")}`;
  return outcome ? `${sides} · ${outcome}` : sides;
}
