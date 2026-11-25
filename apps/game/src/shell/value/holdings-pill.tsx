import { type DirectoryGame } from "../herald";
import { chooseRehearsal, chooseSeason } from "../season-pick";

type Holdings = { fragments: number | null; ancientSeal: boolean };

export const playedSeasonGame = (games: readonly DirectoryGame[]): DirectoryGame | undefined => {
  const season = chooseSeason(games, true);
  const testnet = chooseRehearsal(games, true);
  return [season, testnet].find((game) => game?.status === "Live") ?? season ?? testnet;
};

export const holdingsOf = (games: readonly DirectoryGame[]): Holdings | null => {
  const state = playedSeasonGame(games)?.player_state;
  if (!state || (state.fragments === null && !state.ancient_seal)) return null;
  return { fragments: state.fragments, ancientSeal: state.ancient_seal };
};
