import "./frontier-bar.css";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { Icon } from "@/ui/design-system/icon";
import { ASPECT_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { nativeRaceConstants } from "@bibliothecadao/eternum/game-client";
import { aspectName, catalogAspectId, catalogOrder, formatAmount, RESOURCE_PRECISION } from "@bibliothecadao/types";

import { useAspectBoard } from "../aspect/aspect-page";

export const AspectStandingChip = ({ orderId, onOpenSeason }: { orderId?: number; onOpenSeason: () => void }) => {
  const reading = useAspectBoard();
  const board = reading.known?.race;
  if (!board?.own) return null;
  const aspectId = catalogAspectId(board.own.aspect);
  const standing = board.standings.find((row) => row.aspect === board.own?.aspect);
  const stage = standing?.stage ?? 0;
  const stages = nativeRaceConstants.STAGE_COUNT;
  const ownMember = board.own.members.find((member) => member.mine);
  const glory = ownMember ? Number(ownMember.glory) / RESOURCE_PRECISION : 0;
  const order = orderId && orderId > 0 ? catalogOrder(orderId) : undefined;
  const head = `${aspectName(aspectId)} · ${ASPECT_PAGE_WORDS.stage(stage, stages)}`;

  return (
    <button
      type="button"
      data-aspect-standing-chip=""
      aria-label={`${head}, ${formatAmount(glory)} ${ASPECT_PAGE_WORDS.glory}`}
      className="frontier-aspect-chip pointer-events-auto"
      onClick={onOpenSeason}
    >
      <span className="frontier-aspect-chip__mark">
        <AspectMark aspect={aspectId} size={28} decorative />
      </span>
      <span className="min-w-0">
        <span className="frontier-aspect-chip__head">{head}</span>
        <span className="frontier-aspect-chip__sub">
          <Icon name="victory" size={14} />
          <span>{`${formatAmount(glory)} ${ASPECT_PAGE_WORDS.glory}`}</span>
          {order && <span>{`· ${order.orderName}`}</span>}
        </span>
      </span>
    </button>
  );
};
