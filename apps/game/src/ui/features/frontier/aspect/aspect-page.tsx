import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { openPlace } from "@/play/navigation/open-place";
import { useAllAspectRosters } from "@/shell/herald";
import {
  globalPlaces,
  type GloryIdentity,
  nativeAspectRoster,
  nativeMember,
  type OwnGloryRow,
} from "@/shell/season-tab/glory-rows";
import { requireActiveGame } from "@/runtime/world";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { HudPage, HudSkeleton } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS, SEASON_BOARD_WORDS } from "@/ui/design-system/kit/words";
import { configManager, getStructureName, Position } from "@bibliothecadao/eternum";
import {
  deepViewFor,
  gloryAmount,
  RACE_MODELS,
  readRaceBoard,
  nativeRaceConstants,
  type NativeFactStore,
  type NativeRows,
  type RaceBoard,
} from "@bibliothecadao/eternum/game-client";
import type { GameRef } from "@bibliothecadao/eternum/shard";
import {
  aspectLordsWorth,
  aspectRewardShare,
  aspects,
  catalogAspectId,
  catalogOrder,
  sharesAspectReward,
} from "@bibliothecadao/types";
import { useFrontierRealm } from "../frontier-home";
import { deepLockLine, realmLayers } from "../hud/map-layers";
import { AspectInvite } from "../invite/aspect-invite";
import { SeasonLeaderboard, type SeasonLeaderboardProps, type SeasonStanding } from "./season-leaderboard";

export function useAspectBoard() {
  const { setup } = useGame();
  const home = useFrontierRealm();
  useNativeRevision(RACE_MODELS);
  return readRaceBoard(setup.store, configManager.getActiveGameId(), home?.entity_id ?? null);
}

export function FrontierAspectPage({ day, onClose }: { day?: { day: number; lastDay: number }; onClose: () => void }) {
  const reading = useAspectBoard();
  const board = reading.known?.race;
  if (!board)
    return (
      <HudPage label={SEASON_BOARD_WORDS.title} icon="crown" onClose={onClose}>
        <div data-season-reading={reading.unknown ?? "no race"}>
          <HudSkeleton rows={6} />
        </div>
      </HudPage>
    );
  const { chainId, gameId } = requireActiveGame();
  return <SeasonBoardPage board={board} game={{ chainId, gameId }} day={day} onClose={onClose} />;
}

function SeasonBoardPage({
  board,
  game,
  day,
  onClose,
}: {
  board: RaceBoard;
  game: GameRef;
  day?: { day: number; lastDay: number };
  onClose: () => void;
}) {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const home = useFrontierRealm();
  const served = useAllAspectRosters(game);
  useNativeRevision(["DeepRules", "RealmKnowledge", "SettlementRules"]);
  const named = new Map(served.flatMap(({ data }) => data?.members ?? []).map((member) => [member.entity_id, member]));
  const identityOf = (realm: bigint) => {
    const held = setup.store.get("Structure", { game_id: game.gameId, entity_id: realm });
    return held
      ? { owner: `0x${held.owner.toString(16)}`, realm_id: Number(held.metadata.realm_id) }
      : (named.get(realm.toString()) ?? null);
  };
  const canEnterDeep = home !== null && realmLayers(setup.store, home).includes("deep");
  return (
    <SeasonLeaderboard
      {...seasonBoard(board, home, (realm) => getStructureName(realm, setup.store).name, canEnterDeep, identityOf)}
      names={namesOf(served)}
      day={day}
      invite={home && <AspectInvite realm={home} />}
      goToDeep={goToDeepOf(setup.store, board, home, canEnterDeep, isMapView, onClose)}
      onClose={onClose}
    />
  );
}

function namesOf(served: ReturnType<typeof useAllAspectRosters>): SeasonLeaderboardProps["names"] {
  if (served.some((query) => query.isError))
    return {
      retry: () => {
        for (const query of served) if (query.isError) void query.refetch();
      },
    };
  return served.some((query) => query.isPending) ? "loading" : "ready";
}

function goToDeepOf(
  store: NativeFactStore,
  board: RaceBoard,
  home: NativeRows["Structure"] | null,
  canEnterDeep: boolean,
  isMapView: boolean,
  onClose: () => void,
): SeasonLeaderboardProps["goToDeep"] {
  const gameId = configManager.getActiveGameId();
  const settlementRules = store.get("SettlementRules", { game_id: gameId });
  if (board.result !== null || configManager.isGameOver() || home === null || !settlementRules) return undefined;
  if (canEnterDeep)
    return {
      go: () => {
        const target = deepViewFor(store, gameId, home.entity_id, settlementRules.spacing);
        if (isMapView) requestLayerView(target);
        else openPlace("map", Position.fromContract({ x: target.col, y: target.row }));
        onClose();
      },
    };
  const lock = deepLockLine(store, home);
  return lock ? { refused: { reason: { kind: "failed", line: ASPECT_PAGE_WORDS.deepOpensAt(lock) } } } : undefined;
}

export function seasonBoard(
  board: RaceBoard,
  home: NativeRows["Structure"] | null,
  name: (realm: NativeRows["Structure"]) => string,
  deepOpen: boolean,
  identityOf: (home: bigint) => GloryIdentity | null,
): Omit<SeasonLeaderboardProps, "onClose" | "day" | "invite" | "goToDeep" | "names"> {
  const pools = new Map(
    board.standings.map((row) => [row.aspect, aspectLordsWorth(row.height, board.result?.winner === row.aspect)]),
  );
  const places = globalPlaces(board.aspects);
  return {
    players: board.aspects.reduce((sum, { members }) => sum + members.length, 0),
    race: board.standings.map((row) => ({
      aspectId: catalogAspectId(row.aspect),
      rank: row.rank,
      height: row.height,
      stage: row.stage,
      pool: pools.get(row.aspect)!,
      members: board.aspects.find(({ aspect }) => aspect === row.aspect)?.members.length ?? 0,
      own: row.aspect === board.own?.aspect,
    })),
    finishHeight: board.rules.stage_height * nativeRaceConstants.STAGE_COUNT,
    stages: nativeRaceConstants.STAGE_COUNT,
    result: board.result && { winner: board.result.winner === null ? null : aspectName(board.result.winner) },
    rosters: board.aspects.map(({ aspect, members }) => ({
      aspect: catalogAspectId(aspect),
      roster: nativeAspectRoster(members, identityOf, places),
    })),
    own: board.own && ownRowOf(board.own, identityOf, places),
    standing: home && board.own ? standingOf(board, board.own, home, name(home), pools, places, deepOpen) : null,
  };
}

function ownRowOf(
  own: NonNullable<RaceBoard["own"]>,
  identityOf: (home: bigint) => GloryIdentity | null,
  places: ReadonlyMap<bigint, number>,
): OwnGloryRow | null {
  const aspectPlace = own.members.findIndex((member) => member.mine);
  const mine = own.members[aspectPlace];
  const place = mine && places.get(mine.home);
  const member = mine && nativeMember(aspectPlace + 1, mine, identityOf);
  return member && place ? { aspect: catalogAspectId(own.aspect), member, place, aspectPlace: aspectPlace + 1 } : null;
}

function standingOf(
  board: RaceBoard,
  own: NonNullable<RaceBoard["own"]>,
  home: NativeRows["Structure"],
  realm: string,
  pools: ReadonlyMap<number, number>,
  places: ReadonlyMap<bigint, number>,
  deepOpen: boolean,
): SeasonStanding {
  const mine = own.members.find((member) => member.mine);
  const glory = mine?.glory ?? 0n;
  const sharing = own.members.filter((member) => sharesAspectReward(member.glory));
  const pool = pools.get(own.aspect) ?? 0;
  const shares = sharesAspectReward(glory);
  const standing = board.standings.find((row) => row.aspect === own.aspect);
  const order = home.metadata.order !== 0 ? catalogOrder(home.metadata.order) : null;
  return {
    realm,
    aspectId: catalogAspectId(own.aspect),
    aspectRank: standing?.rank ?? 0,
    order: order && { orderId: order.orderId, orderName: order.orderName },
    glory: gloryAmount(glory),
    gloryRank: (mine && places.get(mine.home)) ?? null,
    shares,
    pool,
    share: shares
      ? Number(
          aspectRewardShare(
            BigInt(pool),
            glory,
            sharing.reduce((sum, member) => sum + member.glory, 0n),
          ),
        )
      : 0,
    stage: standing?.stage ?? 1,
    triumphs: own.triumphs.map(({ stage, day }) => ({
      stage: triumphStage(stage),
      day: day === null ? null : Number(day) + 1,
    })),
    altar: deepOpen ? own.bar : null,
  };
}

function aspectName(id: number): string {
  const aspect = aspects.find((aspect) => aspect.id === id);
  if (!aspect) throw new Error(`Unknown race Aspect ${id}`);
  return aspect.name;
}

function triumphStage(stage: number): keyof typeof ASPECT_PAGE_WORDS.triumph {
  if (!Object.hasOwn(ASPECT_PAGE_WORDS.triumph, stage)) throw new Error(`Unknown Triumph stage ${stage}`);
  return stage as keyof typeof ASPECT_PAGE_WORDS.triumph;
}
