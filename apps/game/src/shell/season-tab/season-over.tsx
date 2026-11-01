import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { getActiveGame } from "@/runtime/world";
import { AppButton } from "@/ui/design-system/kit/app-elements";
import { EXIT, SEASON } from "@/ui/design-system/kit/words";
import { useFrontierBoard, useSeasonViewer } from "@/ui/features/frontier/board/season-board";
import { configManager } from "@bibliothecadao/eternum";
import type { ComponentProps, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useFinishedGame } from "./finished-game";
import { SeasonRecap } from "./season-recap";

/**
 * The season's recap once the game has ended, over the HUD: the same drawing of the season's end as the app's Results
 * (SeasonRecap), with Season and Exit before its Share. The ending is not yet a recorded fact: the mist lifted stands
 * until Herald names it.
 */
export const SeasonOver = ({ withdraw, onSeason }: { withdraw?: ReactNode; onSeason: () => void }) => {
  useNowSeconds();
  return configManager.isGameOver() ? <EndedSeasonRecap withdraw={withdraw} onSeason={onSeason} /> : null;
};

/** The ended season's board, its directory entry and the viewer, read only once the season is over. */
const EndedSeasonRecap = ({ withdraw, onSeason }: { withdraw?: ReactNode; onSeason: () => void }) => {
  const navigate = useNavigate();
  const board = useFrontierBoard((board) => board);
  const gameRef = { chainId: getActiveGame()!.chainId, gameId: configManager.getActiveGameId() };
  return (
    <SeasonOverRecap
      gameRef={gameRef}
      game={useFinishedGame(gameRef)}
      board={board.data}
      viewer={useSeasonViewer()}
      ending="lifted"
      withdraw={withdraw}
      onSeason={onSeason}
      onExit={() => navigate("/")}
    />
  );
};

/** The recap over the HUD, from its facts: Season and Exit before its Share. */
export const SeasonOverRecap = ({
  onSeason,
  onExit,
  ...recap
}: Omit<ComponentProps<typeof SeasonRecap>, "actions" | "cover"> & { onSeason: () => void; onExit: () => void }) => (
  <SeasonRecap
    cover
    {...recap}
    actions={
      <>
        <AppButton kind="secondary" icon="victory" onClick={onSeason}>
          {SEASON}
        </AppButton>
        <AppButton kind="secondary" icon="exit" onClick={onExit}>
          {EXIT}
        </AppButton>
      </>
    }
  />
);
