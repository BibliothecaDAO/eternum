import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useQuery } from "@/hooks/helpers/use-query";
import { openPlace } from "@/play/navigation/open-place";
import { requestLayerView } from "@/three/scenes/worldmap-layer-request";
import { ASPECT_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { configManager, getStructureName, Position } from "@bibliothecadao/eternum";
import {
  deepViewFor,
  gloryAmount,
  RACE_MODELS,
  readRaceBoard,
  nativeRaceConstants,
  type RaceBoard,
} from "@bibliothecadao/eternum/game-client";
import { aspects, catalogAspectId } from "@bibliothecadao/types";
import { useFrontierRealm } from "../frontier-home";
import { realmLayers } from "../hud/map-layers";
import { AspectInvite } from "../invite/aspect-invite";
import { AspectFeedView } from "./aspect-feed-view";
import { useAspectFights } from "./use-aspect-fights";
import { AspectPageView, type AspectPageProps, type AspectTriumph } from "./aspect-page-view";

export function useAspectBoard() {
  const { setup } = useGame();
  const home = useFrontierRealm();
  const now = useNowSeconds();
  useNativeRevision(RACE_MODELS);
  return readRaceBoard(setup.store, configManager.getActiveGameId(), home?.entity_id ?? null, now);
}

export function FrontierAspectPage({ onClose }: { onClose: () => void }) {
  const { setup } = useGame();
  const { isMapView } = useQuery();
  const reading = useAspectBoard();
  const board = reading.known?.race;
  const home = useFrontierRealm();
  const fights = useAspectFights(board?.own?.members.map((member) => member.home.owner) ?? []);
  const now = useNowSeconds();
  useNativeRevision(["DeepRules", "RealmKnowledge", "SettlementRules"]);
  if (!board) return <AspectPageView race={null} own={null} onClose={onClose} />;
  const gameId = configManager.getActiveGameId();
  const canEnterDeep = home !== null && realmLayers(setup.store, home).includes("deep");
  const settlementRules = setup.store.get("SettlementRules", { game_id: gameId });
  const gameOver = board.result !== null || configManager.isGameOver();
  const onGoToDeep =
    !gameOver && canEnterDeep && settlementRules
      ? () => {
          const target = deepViewFor(setup.store, gameId, home.entity_id, settlementRules.spacing);
          if (isMapView) requestLayerView(target);
          else openPlace("map", Position.fromContract({ x: target.col, y: target.row }));
          onClose();
        }
      : undefined;
  return (
    <AspectPageView
      {...aspectPage(board, (home) => getStructureName(home, setup.store).name)}
      fights={<AspectFeedView reading={fights} now={now} />}
      invite={home && <AspectInvite realm={home} />}
      onGoToDeep={onGoToDeep}
      onClose={onClose}
    />
  );
}

export function aspectPage(
  board: RaceBoard,
  name: (home: NonNullable<RaceBoard["own"]>["members"][number]["home"]) => string,
): Omit<AspectPageProps, "onClose"> {
  return {
    race: {
      standings: board.standings.map((row) => ({
        aspectId: catalogAspectId(row.aspect),
        rank: row.rank,
        height: row.height,
        stage: row.stage,
        finished: row.finished,
        own: row.aspect === board.own?.aspect,
      })),
      finishHeight: board.rules.stage_height * nativeRaceConstants.STAGE_COUNT,
      stages: nativeRaceConstants.STAGE_COUNT,
      result: board.result && { winner: board.result.winner === null ? null : aspectName(board.result.winner) },
    },
    own: board.own && {
      aspectId: catalogAspectId(board.own.aspect),
      bar: board.own.bar,
      triumphs: board.own.triumphs.map(({ stage, day }) => ({
        stage: triumphStage(stage),
        day: day === null ? null : Number(day) + 1,
      })),
      members: board.own.members.map((member) => ({
        id: member.home.entity_id.toString(),
        realm: name(member.home),
        mine: member.mine,
        glory: gloryAmount(member.glory),
        guards: member.guards.length ? member.guards.join(", ") : null,
      })),
    },
  };
}

function aspectName(id: number): string {
  const aspect = aspects.find((aspect) => aspect.id === id);
  if (!aspect) throw new Error(`Unknown race Aspect ${id}`);
  return aspect.name;
}

function triumphStage(stage: number): AspectTriumph["stage"] {
  if (!Object.hasOwn(ASPECT_PAGE_WORDS.triumph, stage)) throw new Error(`Unknown Triumph stage ${stage}`);
  return stage as AspectTriumph["stage"];
}
