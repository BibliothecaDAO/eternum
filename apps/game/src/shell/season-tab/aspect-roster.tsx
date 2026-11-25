import { aspectName, aspects, type AspectId } from "@bibliothecadao/types";
import { useLocation, useNavigate } from "react-router-dom";

import { AspectMark } from "@/ui/design-system/aspect-mark";
import { AppBoard, type AppBoardEntry, AppButton, AppEmpty, AppRank } from "@/ui/design-system/kit/app-elements";
import { OrderEmblem } from "@/ui/design-system/kit/order-emblem";
import { PlayerName } from "@/ui/design-system/kit/player-name";
import { ServiceFailure } from "@/ui/design-system/kit/service-failure";
import { ASPECT_PAGE_WORDS, SEASON_WORDS, WORDS } from "@/ui/design-system/kit/words";

import { openedFrom } from "../frame/opened-from";
import { type DirectoryGame, gameRefOf, ROSTER_TOP, useAllAspectRosters, useAspectRoster } from "../herald";
import { Loading } from "../loading";
import { type GloryRow, gloryRowOf, mergeAspectRosters } from "./glory-rows";

export const GlobalGloryRoster = ({
  season,
  ownRealmId,
  rows,
}: {
  season: DirectoryGame;
  ownRealmId: number | null;
  rows: number;
}) => {
  const queries = useAllAspectRosters(gameRefOf(season));
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
        entries={merged.rows
          .slice(0, ROSTER_TOP)
          .map((entry) =>
            gloryBoardEntry(
              gloryRowOf(entry.rank, entry.member, entry.member.realm_id === ownRealmId, entry.aspect),
              () => open(entry.member.owner),
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
  const roster = useAspectRoster(gameRefOf(season), aspect);
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
          gloryBoardEntry(gloryRowOf(member.rank, member, member.realm_id === ownRealmId), () => open(member.owner)),
        )}
      />
    </section>
  );
};

export const gloryBoardEntry = (row: GloryRow, onClick?: () => void): AppBoardEntry => ({
  key: row.key,
  own: row.own,
  onClick,
  lead: (
    <>
      <AppRank rank={row.rank} medal />
      {row.aspect !== undefined && <AspectMark aspect={row.aspect} size={20} decorative />}
    </>
  ),
  name: (
    <span className="season-board__identity">
      <PlayerName account={row.owner} you={row.own} portrait />
      {row.order && (
        <span className="season-board__order" aria-label={row.order.orderName} title={row.order.orderName}>
          <OrderEmblem order={row.order.orderId} size={15} />
          <span className="season-board__order-name">{row.order.orderName}</span>
        </span>
      )}
    </span>
  ),
  figures: [{ icon: "victory", value: row.glory, tone: "gold", label: ASPECT_PAGE_WORDS.glory }],
});
