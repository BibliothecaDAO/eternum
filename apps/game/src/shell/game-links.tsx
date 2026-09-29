import { buildEntryHref } from "@/play/navigation/play-route";

import type { DirectoryGame } from "./herald";

export const modeLabel = (game: DirectoryGame): string => {
  switch (game.mode) {
    case "frontier":
      return "Frontier";
    case "blitz":
      return "Blitz";
    case "eternum":
      return "Eternum";
    case "duel":
      return "Duel";
    default:
      return `Preset ${game.preset_id}`;
  }
};

export const entryHref = (game: DirectoryGame, intent: "play" | "spectate"): string =>
  buildEntryHref({ chainId: game.chainId, gameId: game.game_id, intent, autoSettle: false });
