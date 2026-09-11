import { useNavigateToMapView } from "@/hooks/helpers/use-navigate";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { Position } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import type { LucideIcon } from "lucide-react";
import Castle from "lucide-react/dist/esm/icons/castle";
import Check from "lucide-react/dist/esm/icons/check";
import Clock3 from "lucide-react/dist/esm/icons/clock-3";
import Crown from "lucide-react/dist/esm/icons/crown";
import Hourglass from "lucide-react/dist/esm/icons/hourglass";
import Info from "lucide-react/dist/esm/icons/info";
import Package from "lucide-react/dist/esm/icons/package";
import Shield from "lucide-react/dist/esm/icons/shield";
import Skull from "lucide-react/dist/esm/icons/skull";
import Swords from "lucide-react/dist/esm/icons/swords";
import TriangleAlert from "lucide-react/dist/esm/icons/triangle-alert";
import Trophy from "lucide-react/dist/esm/icons/trophy";
import type { CSSProperties, ReactNode } from "react";
import type { HeadlineType } from "../news-headlines/headline-types";
import {
  extractRoleLabel,
  findSegmentValue,
  formatWinnerName,
  parsePresentationDescription,
} from "../story-events/story-event-utils";
import { transferRowLabel } from "./event-feed-rows";
import { formatFeedTime, type ImportantFeedRow } from "./important-feed-rows";
import { resolveStoryEventPosition } from "./story-feed-row";

/** One feed row in the Log button's translucent black, not the panels' surface: a fixed icon column, one line of
 *  text, the time flush right. */
export const FEED_ROW_CLASS =
  "pointer-events-auto flex h-8 w-full items-center gap-2 rounded-md bg-black/50 px-2.5 text-xs text-gold backdrop-blur-[2px]";
const FEED_ROW_ICON_COLUMN_CLASS = "flex w-4 shrink-0 items-center justify-center";

const HEADLINE_ICONS: Record<HeadlineType, LucideIcon> = {
  "realm-fall": Castle,
  "hyper-capture": Crown,
  elimination: Skull,
  "game-start": Crown,
  "game-end": Trophy,
  "five-min-warning": Clock3,
  "t3-building": Shield,
};

export const HeadlineIcon = ({ type }: { type: HeadlineType }) => {
  const Icon = HEADLINE_ICONS[type];
  return <Icon className="h-4 w-4 shrink-0" />;
};

/** One feed row, quick feed or log: icon, one line of text, the time; a row with a place flies the camera. */
export const FeedRowLine = ({ row, style }: { row: ImportantFeedRow; style?: CSSProperties }) => {
  const target = useFeedRowTarget(row);
  const navigate = useNavigateToMapView();
  const { icon, text } = summarizeFeedRow(row);
  const content = (
    <>
      <span className={FEED_ROW_ICON_COLUMN_CLASS}>{icon}</span>
      <span className="min-w-0 flex-1 truncate text-left">{text}</span>
      <span className="ml-auto shrink-0 text-right tabular-nums text-gold/50">{formatFeedTime(row.at)}</span>
    </>
  );
  if (!target) {
    return (
      <div className={FEED_ROW_CLASS} style={style}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => navigate(target)}
      className={cn(FEED_ROW_CLASS, "font-sans normal-case tracking-normal hover:bg-black/70")}
      style={style}
    >
      {content}
    </button>
  );
};

function useFeedRowTarget(row: ImportantFeedRow): Position | null {
  const {
    setup: { components },
  } = useDojo();
  const structure = useWorldSlicesStore((state) =>
    row.kind === "arrival" ? state.structures.find((entry) => entry.entity_id === row.structureEntityId) : undefined,
  );
  if (row.kind === "headline") {
    return row.headline.location ? new Position({ x: row.headline.location.x, y: row.headline.location.y }) : null;
  }
  if (row.kind === "story") return resolveStoryEventPosition(row.event, components);
  if (row.kind === "arrival") {
    return structure ? new Position({ x: structure.base.coord_x, y: structure.base.coord_y }) : null;
  }
  if (row.kind === "notice") return row.notice.location ? new Position(row.notice.location) : null;
  return null;
}

function summarizeFeedRow(row: ImportantFeedRow): { icon: ReactNode; text: ReactNode } {
  if (row.kind === "headline") {
    return { icon: <HeadlineIcon type={row.headline.type} />, text: row.headline.description };
  }
  if (row.kind === "story") return { icon: <Swords className="h-4 w-4 shrink-0" />, text: summarizeStory(row) };
  if (row.kind === "arrival") {
    return {
      icon: <Package className="h-4 w-4 shrink-0" />,
      text: `${transferRowLabel(row)} · #${row.structureEntityId}`,
    };
  }
  if (row.kind === "transaction") {
    const { transaction, isStuck } = row;
    const failed = transaction.status === "reverted";
    const status = isStuck ? "Stuck" : failed ? "Failed" : transaction.status === "success" ? "Done" : "Pending";
    const Icon = isStuck || failed ? TriangleAlert : transaction.status === "success" ? Check : Hourglass;
    return {
      icon: <Icon className={cn("h-4 w-4 shrink-0", (isStuck || failed) && "text-danger")} />,
      text: `${transferRowLabel(row) ?? transaction.description} · ${status}`,
    };
  }
  const Icon =
    row.notice.kind === "error" || row.notice.kind === "warning"
      ? TriangleAlert
      : row.notice.kind === "success"
        ? Check
        : Info;
  return { icon: <Icon className="h-4 w-4 shrink-0" />, text: row.notice.title };
}

function summarizeStory(row: Extract<ImportantFeedRow, { kind: "story" }>): string {
  const { event } = row;
  if (event.story !== "BattleStory") return event.presentation.title;
  const description = event.presentation.description;
  const winner = formatWinnerName(
    findSegmentValue(parsePresentationDescription(description), (label) => label === "Winner"),
  );
  const sides = `${extractRoleLabel(description, "Attacker")} vs ${extractRoleLabel(description, "Defender")}`;
  return winner ? `${sides} · ${winner} wins` : sides;
}
