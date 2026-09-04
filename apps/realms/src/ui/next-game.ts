import type { DirectoryGame } from "@/services/herald";

/** The soonest game still taking registrations — what PLAY and the featured slot point at. */
export const nextOpenGame = (games: readonly DirectoryGame[]): DirectoryGame | undefined =>
  [...games]
    .filter((game) => game.status === "Created" || game.status === "Registration")
    .sort((a, b) => a.clock.start_main_at - b.clock.start_main_at)[0];
