import { formatAmount, LORDS } from "@bibliothecadao/types";
import type { HeraldFrontierLeaderboardEntry } from "@bibliothecadao/eternum/game-sync";
import { useLocation, useNavigate } from "react-router-dom";

import { AppBoard, type AppBoardEntry, AppRank } from "@/ui/design-system/kit/app-elements";
import { RealmBadge } from "@/ui/features/frontier/board/realm-marks";
import { realmSkinOf } from "@/three/structures/realm-skins";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { SEASON_WORDS } from "@/ui/design-system/kit/words";
import { wholeLords } from "@/ui/features/frontier/board/standings";

import { openedFrom } from "../frame/opened-from";

/**
 * A Frontier board's rows, every realm's: each realm's rank (the first three's medals) and home, its player, the sites
 * it cleared (what ranks) and its LORDS, each in its column, in a scroll area `rows` rows tall. The player's own row is
 * lit; a row opens its player.
 */
export const FrontierRows = ({
  entries,
  own,
  rows,
}: {
  entries: readonly HeraldFrontierLeaderboardEntry[];
  own: HeraldFrontierLeaderboardEntry | undefined;
  rows: number;
}) => {
  const navigate = useNavigate();
  const here = useLocation();
  const open = (address: string) => navigate(`/p/${address}`, { state: openedFrom(here) });
  return (
    <AppBoard
      rows={rows}
      entries={entries.map((entry) => frontierEntry(entry, entry === own, () => open(entry.address)))}
    />
  );
};

const frontierEntry = (entry: HeraldFrontierLeaderboardEntry, own: boolean, onClick: () => void): AppBoardEntry => ({
  key: entry.address,
  own,
  onClick,
  lead: (
    <>
      <AppRank rank={entry.rank} medal />
      <RealmBadge
        level={entry.level}
        depth={entry.deepest_depth}
        skin={realmSkinOf(entry.campaign)}
        hasWonder={entry.has_wonder}
      />
    </>
  ),
  name: <PlayerName account={entry.address} you={own} portrait />,
  figures: [
    { icon: "explore", value: formatAmount(entry.sites_cleared.total), label: SEASON_WORDS.sitesCleared },
    { icon: "lords", value: formatAmount(wholeLords(entry.rewards.lords)), tone: "gold", label: LORDS },
  ],
});
