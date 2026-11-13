/** Each game as its age of the lore. */
export const AGES = {
  blitz: { game: "Blitz", age: "Age I" },
  frontier: { game: "Frontier", age: "Age II" },
  eternum: { game: "Eternum", age: "Age III" },
} as const;
export const ageLine = (game: keyof typeof AGES): string => `${AGES[game].game} · ${AGES[game].age}`;

/**
 * Every mode a game is created in, as players name it: the lore's ages. The one table the app's labels and
 * the game's pushes read; it imports nothing, so the push builders take it without the rest of the catalog.
 */
export const GAME_MODE_NAMES = {
  blitz: AGES.blitz.game,
  frontier: AGES.frontier.game,
  eternum: AGES.eternum.game,
} as const;
export type GameModeName = keyof typeof GAME_MODE_NAMES;
