import { type GameClient } from "@bibliothecadao/eternum";
import { hasGameEnded } from "@bibliothecadao/eternum/game-sync";

export type GamePhase = "unknown" | "registration" | "live" | "ended";

export interface GameRegistryClock {
  status: string;
  startMainAt: number;
  endAt: number;
}

/** The registry row is keyed by the game id alone, not under the active game prefix. */
export const readGameRegistry = (client: GameClient): GameRegistryClock | null => {
  const registry = client.setup.store.get("GameRegistry", { game_id: client.gameId });
  if (!registry) return null;
  return {
    status: registry.settled ? "Ended" : "Live",
    startMainAt: Number(registry.start_main_at),
    endAt: Number(registry.end_at),
  };
};

/** The registry row is the game's clock: a finite end closes the game even before the status row says so. */
export const resolveGamePhase = (registry: GameRegistryClock | null, now: number): GamePhase => {
  if (!registry) return "unknown";
  if (hasGameEnded(registry.status, registry.endAt, now)) return "ended";
  if (now < registry.startMainAt) return "registration";
  return "live";
};

export const readGamePhase = (client: GameClient, now: number): GamePhase =>
  resolveGamePhase(readGameRegistry(client), now);
