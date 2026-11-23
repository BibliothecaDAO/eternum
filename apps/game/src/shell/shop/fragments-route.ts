import { safeNextPath } from "../return-path";

export const FRAGMENTS_PATH = "/shop";

export const fragmentsHref = (game: { chainId: string; gameId: number }, next: string): string =>
  `${FRAGMENTS_PATH}?${new URLSearchParams({ chain: game.chainId, game: String(game.gameId), next: safeNextPath(next) })}`;
