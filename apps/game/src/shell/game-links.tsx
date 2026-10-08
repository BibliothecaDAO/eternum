import { buildEntryHref } from "@/play/navigation/play-route";

import type { DirectoryGame } from "./herald";
import type { Painting } from "./paintings";
import { ageOf } from "./play/ages";

export const modeLabel = (game: Pick<DirectoryGame, "mode" | "preset_id">): string => {
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

/** The age painting a game's doorway stands on; a Duel is a Blitz match (its config is Blitz's), an unknown mode has none. */
export const gamePainting = (game: Pick<DirectoryGame, "mode">): Painting | undefined => {
  switch (game.mode) {
    case "frontier":
    case "blitz":
    case "eternum":
      return ageOf(game.mode).painting;
    case "duel":
      return ageOf("blitz").painting;
    default:
      return undefined;
  }
};

export const entryHref = (game: DirectoryGame, intent: "play" | "spectate"): string =>
  buildEntryHref({ chainId: game.chainId, gameId: game.game_id, intent, autoSettle: false });
