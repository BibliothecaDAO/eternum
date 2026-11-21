import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { useNativeRevision } from "@/hooks/helpers/use-native-facts";
import { useGame } from "@/hooks/context/game-context";
import { FrontierAspectPage } from "@/ui/features/frontier/aspect/aspect-page";
import { getActiveGame } from "@/runtime/world";
import { AppButton, AppIconButton } from "@/ui/design-system/kit/app-elements";
import { EXIT } from "@/ui/design-system/kit/words";
import { useFrontierBoard, useSeasonViewer } from "@/ui/features/frontier/board/season-board";
import { configManager } from "@bibliothecadao/eternum";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "../frame/layout";
import { useFinishedGame } from "./finished-game";
import { SeasonRecap } from "./season-recap";

/** The ended game's native race board, or its format's recap, over the HUD. */
export const SeasonOver = ({ withdraw }: { withdraw?: ReactNode }) => {
  const { setup } = useGame();
  useNativeRevision(["RaceRules", "GameRegistry", "RaceResult"]);
  useNowSeconds();
  if (!configManager.isGameOver()) return null;
  return setup.store.get("RaceRules", { game_id: configManager.getActiveGameId() }) ? (
    <EndedRace withdraw={withdraw} />
  ) : (
    <EndedSeason withdraw={withdraw} />
  );
};

const EndedRace = ({ withdraw }: { withdraw?: ReactNode }) => {
  const navigate = useNavigate();
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return (
    <div
      data-race-ended
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-kit-ground/90 p-2 lg:p-8"
    >
      <div className="flex max-h-full w-full max-w-2xl flex-col gap-2 overflow-y-auto">
        <FrontierAspectPage onClose={() => setClosed(true)} />
        {withdraw}
        <AppButton kind="primary" icon="exit" onClick={() => navigate("/")}>
          {EXIT}
        </AppButton>
      </div>
    </div>
  );
};

const EndedSeason = ({ withdraw }: { withdraw?: ReactNode }) => {
  const navigate = useNavigate();
  const board = useFrontierBoard((board) => board).data;
  const gameRef = { chainId: getActiveGame()!.chainId, gameId: configManager.getActiveGameId() };
  const game = useFinishedGame(gameRef);
  const viewer = useSeasonViewer();
  return (
    <SeasonOverRecap
      gameRef={gameRef}
      game={game}
      board={board}
      viewer={viewer}
      ending="lifted"
      withdraw={withdraw}
      onExit={() => navigate("/")}
    />
  );
};

/**
 * The recap over the HUD, from its facts: Exit before its sharing, in one row; a phone draws Exit as its icon, so the
 * row fits its width. The season's board is in the recap's cards and on Results, so the cover offers no second way.
 */
export const SeasonOverRecap = ({
  onExit,
  ...recap
}: Omit<ComponentProps<typeof SeasonRecap>, "actions" | "cover"> & { onExit: () => void }) => {
  const exit =
    useLayout() === "phone" ? (
      <AppIconButton kind="secondary" icon="exit" label={EXIT} onClick={onExit} />
    ) : (
      <AppButton kind="secondary" icon="exit" onClick={onExit}>
        {EXIT}
      </AppButton>
    );
  return <SeasonRecap cover {...recap} actions={exit} />;
};
