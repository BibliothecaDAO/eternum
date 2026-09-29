let activeGameId = 0;
export const setGameScope = (gameId: number): void => {
  activeGameId = gameId;
};
export const getScopedGameId = (): number => activeGameId;
