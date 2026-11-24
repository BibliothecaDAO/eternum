import { compareAspectMembers, gloryAmount } from "@bibliothecadao/eternum/game-client";
import type { HeraldAspectRoster, HeraldAspectRosterMember } from "@bibliothecadao/eternum/game-sync";
import { aspectName, aspects, formatAmount, type AspectId } from "@bibliothecadao/types";
import { useLocation, useNavigate } from "react-router-dom";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppBoard, type AppBoardEntry, AppButton, AppEmpty, AppRank } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { ASPECT_PAGE_WORDS, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";

import { openedFrom } from "../frame/opened-from";
import { type DirectoryGame, ROSTER_TOP, useAllAspectRosters, useAspectRoster } from "../herald";
import { Loading } from "../loading";
import { realmHomeOf } from "../season";

interface GloryRosterRow {
  aspect: AspectId;
  rank: number;
  member: HeraldAspectRosterMember;
}

export const mergeAspectRosters = (
  rosters: readonly { aspect: AspectId; roster: HeraldAspectRoster }[],
): { total: number; rows: GloryRosterRow[] } => {
  const total = rosters.reduce((sum, { roster }) => sum + roster.total, 0);
  const rows = rosters
    .flatMap(({ aspect, roster }) => roster.members.map((member) => ({ aspect, member })))
    .toSorted((left, right) =>
      compareAspectMembers(
        { glory: BigInt(left.member.glory), home: BigInt(left.member.entity_id) },
        { glory: BigInt(right.member.glory), home: BigInt(right.member.entity_id) },
      ),
    )
    .slice(0, ROSTER_TOP)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  return { total, rows };
};

export const GlobalGloryRoster = ({
  season,
  ownRealmId,
  rows,
}: {
  season: DirectoryGame;
  ownRealmId: number | null;
  rows: number;
}) => {
  const queries = useAllAspectRosters(season);
  const navigate = useNavigate();
  const here = useLocation();
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <section className="p-4" data-global-roster>
        <ServiceFailure
          service="season"
          error={failed.error}
          retry={() => {
            for (const query of queries) {
              if (query.isError) void query.refetch();
            }
          }}
        />
      </section>
    );
  }
  if (queries.some((query) => !query.data)) {
    return (
      <section className="p-4" data-global-roster>
        <Loading />
      </section>
    );
  }
  const merged = mergeAspectRosters(aspects.map(({ id }, index) => ({ aspect: id, roster: queries[index]!.data! })));
  if (merged.rows.length === 0) {
    return (
      <section data-global-roster>
        <AppEmpty
          icon="leaderboard"
          line={SEASON_WORDS.boardEmpty}
          action={
            <AppButton kind="secondary" icon="play" to="/">
              {WORDS.play}
            </AppButton>
          }
        />
      </section>
    );
  }
  const open = (owner: string) => navigate(`/p/${owner}`, { state: openedFrom(here) });
  return (
    <section className="flex flex-col" data-global-roster>
      <div className="season-board__subhead">
        <span className="text-app-label text-app-muted">{SEASON_WORDS.globalTopPlayers(merged.total)}</span>
      </div>
      <AppBoard
        rows={rows}
        entries={merged.rows.map((entry) =>
          gloryBoardEntry(
            entry.rank,
            entry.member,
            entry.member.realm_id === ownRealmId,
            () => open(entry.member.owner),
            entry.aspect,
          ),
        )}
      />
    </section>
  );
};

export const AspectRoster = ({
  season,
  aspect,
  ownRealmId,
  ownAspect = false,
  rows,
}: {
  season: DirectoryGame;
  aspect: AspectId;
  ownRealmId: number | null;
  ownAspect?: boolean;
  rows: number;
}) => {
  const roster = useAspectRoster(season, aspect);
  const navigate = useNavigate();
  const here = useLocation();
  if (roster.isError) {
    return (
      <section className="p-4" data-aspect-roster={aspect}>
        <ServiceFailure service="season" error={roster.error} retry={() => void roster.refetch()} />
      </section>
    );
  }
  if (!roster.data) {
    return (
      <section className="p-4" data-aspect-roster={aspect}>
        <Loading />
      </section>
    );
  }
  if (roster.data.members.length === 0) {
    return (
      <section className="p-4" data-aspect-roster={aspect}>
        <p className="text-app-label text-app-muted">{SEASON_WORDS.aspectRosterEmpty(aspectName(aspect))}</p>
      </section>
    );
  }
  const heading = ownAspect
    ? SEASON_WORDS.aspectRoster(roster.data.total)
    : SEASON_WORDS.aspectTopPlayers(aspectName(aspect), roster.data.total);
  const open = (owner: string) => navigate(`/p/${owner}`, { state: openedFrom(here) });
  return (
    <section className="flex flex-col" data-aspect-roster={aspect}>
      <div className="season-board__subhead">
        <span className="text-app-label text-app-muted">{heading}</span>
      </div>
      <AppBoard
        rows={rows}
        entries={roster.data.members.map((member) =>
          gloryBoardEntry(member.rank, member, member.realm_id === ownRealmId, () => open(member.owner)),
        )}
      />
    </section>
  );
};

const gloryBoardEntry = (
  rank: number,
  member: HeraldAspectRosterMember,
  own: boolean,
  onClick: () => void,
  aspect?: AspectId,
): AppBoardEntry => {
  const { realm, order } = realmHomeOf(member.realm_id);
  return {
    key: member.entity_id,
    own,
    onClick,
    lead: (
      <>
        <AppRank rank={rank} medal />
        {aspect !== undefined && <AspectMark aspect={aspect} size={20} decorative />}
      </>
    ),
    name: (
      <span className="season-board__identity">
        <PlayerName account={member.owner} you={own} portrait />
        <span className="season-board__realm">
          {order && <OrderEmblem order={order.orderId} size={14} />}
          <span className="truncate">{order ? `${realm.name} · ${order.orderName}` : realm.name}</span>
        </span>
      </span>
    ),
    figures: [
      {
        icon: "victory",
        value: formatAmount(gloryAmount(member.glory)),
        tone: "gold",
        label: ASPECT_PAGE_WORDS.glory,
      },
    ],
  };
};
