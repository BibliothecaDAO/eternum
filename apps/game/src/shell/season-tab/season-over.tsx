import { useNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { getActiveGame } from "@/runtime/world";
import { campaignOfPreset } from "@/services/home-claim-rules";
import { AppButton, AppIconButton } from "@/ui/design-system/kit/app-elements";
import { EXIT, FESTIVAL_WORDS, SEASON } from "@/ui/design-system/kit/words";
import { useFrontierBoard, useSeasonViewer } from "@/ui/features/frontier/board/season-board";
import { findOwnEntry } from "@/ui/features/frontier/board/standings";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeRows } from "@bibliothecadao/eternum/game-client";
import { useState, type ComponentProps, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useLayout } from "../frame/layout";
import { DEVCON } from "../join/devcon";
import { seasonEnded } from "../season";
import type { DirectoryGame } from "../herald";
import { useFinishedGame } from "./finished-game";
import { SeasonGreeting, useSeasonHome } from "./festival";
import { prizeOf, SeasonRecap } from "./season-recap";

/**
 * The season's recap once the game has ended, over the HUD: the same drawing of the season's end as the app's Results
 * (SeasonRecap), with Season and Exit before its sharing. In the Devcon season, which ends on Diwali, a player on the
 * board is greeted first (SeasonGreeting) and See my season opens the recap. The ending is not yet a recorded fact: the
 * mist lifted stands until Herald names it.
 */
export const SeasonOver = ({
  realm,
  withdraw,
  onSeason,
}: {
  /** The player's realm, whose home the greeting draws; null for a spectator or a visit. */
  realm: NativeRows["Structure"] | null;
  withdraw?: ReactNode;
  onSeason: () => void;
}) => {
  useNowSeconds();
  return configManager.isGameOver() ? <EndedSeason realm={realm} withdraw={withdraw} onSeason={onSeason} /> : null;
};

/** The ended season's board, its directory entry, the viewer and their home, read only once the season is over. */
const EndedSeason = ({
  realm,
  withdraw,
  onSeason,
}: {
  realm: NativeRows["Structure"] | null;
  withdraw?: ReactNode;
  onSeason: () => void;
}) => {
  const navigate = useNavigate();
  const [greeted, setGreeted] = useState(false);
  const board = useFrontierBoard((board) => board).data;
  const gameRef = { chainId: getActiveGame()!.chainId, gameId: configManager.getActiveGameId() };
  const game = useFinishedGame(gameRef);
  const viewer = useSeasonViewer();
  const home = useSeasonHome(realm);
  const own = board && findOwnEntry(board.entries, viewer);
  const cut = useLayout() === "phone" ? "tall" : "wide";
  if (!greeted && game && board && own && home && isDiwaliSeason(game))
    return (
      <SeasonGreeting
        cut={cut}
        season={seasonEnded(game)}
        home={home}
        rank={own.rank}
        field={board.entries.length}
        prize={prizeOf(board, own)}
        step={
          <AppButton kind="primary" icon="victory" step onClick={() => setGreeted(true)}>
            {FESTIVAL_WORDS.seeSeason}
          </AppButton>
        }
      />
    );
  return (
    <SeasonOverRecap
      gameRef={gameRef}
      game={game}
      board={board}
      viewer={viewer}
      ending="lifted"
      withdraw={withdraw}
      onSeason={onSeason}
      onExit={() => navigate("/")}
    />
  );
};

/** The Devcon campaign's season, whose end falls on Diwali: its games are the campaign's presets'. */
const isDiwaliSeason = (game: DirectoryGame) => campaignOfPreset(game.preset_id) === DEVCON.campaign;

/**
 * The recap over the HUD, from its facts: Season and Exit before its sharing, in one row; a phone draws Season and
 * Exit as their icons, so the row fits its width.
 */
export const SeasonOverRecap = ({
  onSeason,
  onExit,
  ...recap
}: Omit<ComponentProps<typeof SeasonRecap>, "actions" | "cover"> & { onSeason: () => void; onExit: () => void }) => {
  const phone = useLayout() === "phone";
  return (
    <SeasonRecap
      cover
      {...recap}
      actions={
        phone ? (
          <>
            <AppIconButton kind="secondary" icon="victory" label={SEASON} onClick={onSeason} />
            <AppIconButton kind="secondary" icon="exit" label={EXIT} onClick={onExit} />
          </>
        ) : (
          <>
            <AppButton kind="secondary" icon="victory" onClick={onSeason}>
              {SEASON}
            </AppButton>
            <AppButton kind="secondary" icon="exit" onClick={onExit}>
              {EXIT}
            </AppButton>
          </>
        )
      }
    />
  );
};
