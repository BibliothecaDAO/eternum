import { gloryAmount } from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";
import { formatAmount, type AspectId } from "@bibliothecadao/types";
import { useLocation, useNavigate } from "react-router-dom";

import { AppBoard, type AppBoardEntry, AppRank } from "@/ui/design-system/kit/app-elements";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ASPECT_PAGE_WORDS, SEASON_WORDS } from "@/ui/design-system/kit/words";

import { openedFrom } from "../frame/opened-from";
import { type DirectoryGame, useAspectRoster } from "../herald";

export const AspectRoster = ({
  season,
  aspect,
  ownRealmId,
}: {
  season: DirectoryGame;
  aspect: AspectId;
  ownRealmId: number | null;
}) => {
  const roster = useAspectRoster(season, aspect);
  const navigate = useNavigate();
  const here = useLocation();
  if (!roster.data || roster.data.members.length === 0) return null;
  const open = (owner: string) => navigate(`/p/${owner}`, { state: openedFrom(here) });
  return (
    <section className="flex flex-col gap-2" data-aspect-roster>
      <span className="text-app-strong text-app-ink">{SEASON_WORDS.aspectRoster(roster.data.total)}</span>
      <AppBoard
        rows={roster.data.members.length}
        entries={roster.data.members.map((member) =>
          rosterEntry(member, member.realm_id === ownRealmId, () => open(member.owner)),
        )}
      />
    </section>
  );
};

const rosterEntry = (member: HeraldAspectRosterMember, own: boolean, onClick: () => void): AppBoardEntry => ({
  key: member.entity_id,
  own,
  onClick,
  lead: <AppRank rank={member.rank} medal />,
  name: <PlayerName account={member.owner} you={own} portrait />,
  figures: [
    {
      icon: "victory",
      value: formatAmount(gloryAmount(member.glory)),
      label: ASPECT_PAGE_WORDS.glory,
    },
  ],
});
