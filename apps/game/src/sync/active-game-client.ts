import type { GameClient } from "@bibliothecadao/eternum";
import { disposeActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";

/**
 * The web client's handle on the game it booted. Bootstrap installs it once `createGameClient` resolves;
 * the network status surface recovers through it and a bootstrap reset disposes it.
 */
let activeGameClient: GameClient | null = null;

export const installActiveGameClient = (client: GameClient): void => {
  activeGameClient = client;
};

export const disposeGameSyncSession = (): void => {
  activeGameClient?.dispose();
  activeGameClient = null;
  // A bootstrap still inside createGameClient owns no handle yet; its runtime is the active one.
  disposeActiveGameSyncRuntime();
};

/** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
export const recoverGameSyncSession = async (): Promise<void> => {
  if (!activeGameClient) throw new Error("No game client is active to recover");
  await activeGameClient.recover();
};
