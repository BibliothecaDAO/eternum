import { formatAmount } from "@bibliothecadao/types";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useLocation, useNavigate } from "react-router-dom";

import { AppChip, AppRank, AppRow } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SEASON_WORDS } from "@/ui/design-system/kit/words";
import { wholeLords } from "@/ui/features/frontier/board/standings";

import { openedFrom } from "../frame/opened-from";

/**
 * One realm on a Frontier board, as Season and a season's Results draw it: its rank (the first three's medals) and Order,
 * its player, the sites it cleared (what ranks) and its LORDS, each with its icon, on one line at any width. The
 * player's own row is lit; a row opens its player.
 */
export const FrontierRow = ({ entry, own }: { entry: HeraldFrontierLeaderboardEntry; own: boolean }) => {
  const navigate = useNavigate();
  const here = useLocation();
  return (
    <AppRow
      own={own}
      line
      lead={
        <>
          <AppRank rank={entry.rank} medal />
          <OrderEmblem order={entry.order} />
        </>
      }
      title={<PlayerName account={entry.address} you={own} portrait />}
      trail={
        <>
          <AppChip icon="explore" label={SEASON_WORDS.sitesCleared}>
            {formatAmount(entry.sites_cleared.total)}
          </AppChip>
          <AppChip icon="lords" tone="gold" label="LORDS">
            {formatAmount(wholeLords(entry.rewards.lords))}
          </AppChip>
        </>
      }
      onClick={() => navigate(`/p/${entry.address}`, { state: openedFrom(here) })}
    />
  );
};
