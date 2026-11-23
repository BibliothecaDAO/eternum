import { GAME_MODE_NAMES } from "@bibliothecadao/types";
import { buildEntryHref } from "@/play/navigation/play-route";

import type { DirectoryGame } from "./herald";
import type { Painting } from "@/ui/design-system/kit/paintings";
import { ageOf } from "./play/ages";

export const modeLabel = (game: Pick<DirectoryGame, "mode">): string => GAME_MODE_NAMES[game.mode];

export const gamePainting = (game: Pick<DirectoryGame, "mode">): Painting => ageOf(game.mode).painting;

export const entryHref = (game: Pick<DirectoryGame, "chainId" | "game_id">, intent: "play" | "spectate"): string =>
  buildEntryHref({ chainId: game.chainId, gameId: game.game_id, intent, autoSettle: false });
