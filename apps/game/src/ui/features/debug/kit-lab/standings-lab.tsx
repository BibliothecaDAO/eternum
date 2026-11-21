import { LeaderboardSurface } from "@/ui/features/social/components/social-board";

import { LabGame } from "./lab-game";
import { PLAYER } from "./fixture-game";

const PLAYERS = [PLAYER, "0x222", "0x333", "0x444"];

const playerFacts = () =>
  PLAYERS.map((address) => ({
    model: "PlayerEntry",
    key: `0x7c${address.slice(2)}`,
    value: { game_id: 1, owner: address, player: address },
  }));

/** The Blitz standings at /lab/kit/standings: Players opens each card and returns to the list. */
export const StandingsLab = () => (
  <div data-lab="standings" className="ui flex min-h-screen items-start justify-center bg-hud-surface p-2">
    <LabGame mode="blitz" facts={playerFacts}>
      {() => <LeaderboardSurface />}
    </LabGame>
  </div>
);
