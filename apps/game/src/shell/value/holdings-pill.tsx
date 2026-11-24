import { type DirectoryGame } from "../herald";
import { chooseRehearsal, chooseSeason } from "../season-pick";

type Holdings = { fragments: number | null; ancientSeal: boolean };

export const holdingsOf = (games: readonly DirectoryGame[]): Holdings | null => {
  const season = chooseSeason(games, true);
  const testnet = chooseRehearsal(games, true);
  const played = [season, testnet].find((game) => game?.status === "Live") ?? season ?? testnet;
  const state = played?.player_state;
  if (!state || (state.fragments === null && !state.ancient_seal)) return null;
  return { fragments: state.fragments, ancientSeal: state.ancient_seal };
};
