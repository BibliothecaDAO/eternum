import type { GameChain } from "@realms-world/chain";

export type GameNamespace = "s2";
export const namespaceForChain = (_chain: GameChain): GameNamespace => "s2";

let activeGameId = 0;
export const setGameScope = (_namespace: GameNamespace, gameId: number): void => {
  activeGameId = gameId;
};
export const getScopedGameId = (): number => activeGameId;
