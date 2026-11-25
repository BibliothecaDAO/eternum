import { useGame } from "@/hooks/context/game-context";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { openPlace } from "@/play/navigation/open-place";
import { nativeAspectRoster } from "@/shell/season-tab/glory-rows";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { HudPage, HudSkeleton } from "@/ui/design-system/kit/hud-elements";
import { ASPECT_PAGE_WORDS, SEASON_BOARD_WORDS } from "@/ui/design-system/kit/words";
import { configManager, getStructureName, Position } from "@bibliothecadao/eternum";
import {
  compareAspectMembers,
  deepViewFor,
  gloryAmount,
  RACE_MODELS,
  readRaceBoard,
  nativeRaceConstants,
  type NativeRows,
  type RaceBoard,
} from "@bibliothecadao/eternum/game-client";
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
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const reading = useAspectBoard();
  const board = reading.known?.race;
  const home = useFrontierRealm();
  useNativeRevision(["DeepRules", "RealmKnowledge", "SettlementRules"]);
  if (!board)
    return (
      <HudPage label={SEASON_BOARD_WORDS.title} icon="crown" onClose={onClose}>
        <div data-season-reading={reading.unknown ?? "no race"}>
          <HudSkeleton rows={6} />
        </div>
      </HudPage>
    );
  const gameId = configManager.getActiveGameId();
  const canEnterDeep = home !== null && realmLayers(setup.store, home).includes("deep");
  const settlementRules = setup.store.get("SettlementRules", { game_id: gameId });
  const gameOver = board.result !== null || configManager.isGameOver();
  const goDeep = (realm: NonNullable<typeof home>, spacing: number) => {
    const target = deepViewFor(setup.store, gameId, realm.entity_id, spacing);
    if (isMapView) requestLayerView(target);
    else openPlace("map", Position.fromContract({ x: target.col, y: target.row }));
    onClose();
  };
  const lock = home && deepLockLine(setup.store, home);
  const goToDeep =
    gameOver || home === null || !settlementRules
      ? undefined
      : canEnterDeep
        ? { go: () => goDeep(home, settlementRules.spacing) }
        : lock
          ? { refused: { reason: { kind: "failed" as const, line: ASPECT_PAGE_WORDS.deepOpensAt(lock) } } }
          : undefined;
  return (
    <SeasonLeaderboard
      {...seasonBoard(board, home, (realm) => getStructureName(realm, setup.store).name, canEnterDeep)}
      day={day}
      invite={home && <AspectInvite realm={home} />}
      goToDeep={goToDeep}
      onClose={onClose}
    />
  );
}

export function seasonBoard(
  board: RaceBoard,
  home: NativeRows["Structure"] | null,
  name: (realm: NativeRows["Structure"]) => string,
  deepOpen: boolean,
): Omit<SeasonLeaderboardProps, "onClose" | "day" | "invite" | "goToDeep"> {
  const pools = new Map(
    board.standings.map((row) => [row.aspect, aspectLordsWorth(row.height, board.result?.winner === row.aspect)]),
  );
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
      roster: nativeAspectRoster(members),
    })),
    ownEntityId: home ? home.entity_id.toString() : null,
    standing: home && board.own ? standingOf(board, board.own, home, name(home), pools, deepOpen) : null,
  };
}

function standingOf(
  board: RaceBoard,
  own: NonNullable<RaceBoard["own"]>,
  home: NativeRows["Structure"],
  realm: string,
  pools: ReadonlyMap<number, number>,
  deepOpen: boolean,
): SeasonStanding {
  const mine = own.members.find((member) => member.mine);
  const glory = mine?.glory ?? 0n;
  const everyone = board.aspects
    .flatMap(({ members }) => members)
    .toSorted((a, b) =>
      compareAspectMembers({ glory: a.glory, home: a.home.entity_id }, { glory: b.glory, home: b.home.entity_id }),
    );
  const place = everyone.findIndex((member) => member.mine);
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
    gloryRank: place < 0 ? null : place + 1,
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
