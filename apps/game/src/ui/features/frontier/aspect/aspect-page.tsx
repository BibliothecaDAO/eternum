import { useGame } from "@/hooks/context/game-context";
import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { ASPECT_PAGE_WORDS } from "@/ui/design-system/kit/words";
import { configManager, getStructureName } from "@bibliothecadao/eternum";
import { RACE_MODELS, readRaceBoard, nativeRaceConstants, type RaceBoard } from "@bibliothecadao/eternum/game-client";
import { aspectLordsWorth, aspects, RESOURCE_PRECISION } from "@bibliothecadao/types";
import { useFrontierRealm } from "../frontier-home";
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
  const reading = useAspectBoard();
  const board = reading.known?.race;
  const home = useFrontierRealm();
  const fights = useAspectFights(board?.own?.members.map((member) => member.home.owner) ?? []);
  const now = useNowSeconds();
  if (!board) return <AspectPageView race={null} own={null} onClose={onClose} />;
  return (
    <AspectPageView
      {...aspectPage(board, (home) => getStructureName(home, setup.store).name)}
      fights={<AspectFeedView reading={fights} now={now} />}
      invite={home && <AspectInvite realm={home} />}
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
        aspect: aspectName(row.aspect),
        rank: row.rank,
        height: row.height,
        stage: row.stage,
        finished: row.finished,
        own: row.aspect === board.own?.aspect,
        lords: aspectLordsWorth(row.height, board.result?.winner === row.aspect),
      })),
      finishHeight: board.rules.stage_height * nativeRaceConstants.STAGE_COUNT,
      stages: nativeRaceConstants.STAGE_COUNT,
      result: board.result && { winner: board.result.winner === null ? null : aspectName(board.result.winner) },
    },
    own: board.own && {
      aspect: aspectName(board.own.aspect),
      bar: board.own.bar,
      triumphs: board.own.triumphs.map(({ stage, day }) => ({
        stage: triumphStage(stage),
        day: day === null ? null : Number(day) + 1,
      })),
      members: board.own.members.map((member) => ({
        id: member.home.entity_id.toString(),
        realm: name(member.home),
        mine: member.mine,
        glory: Number(member.glory) / RESOURCE_PRECISION,
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
