import { useAccountStore } from "@/hooks/store/use-account-store";
import type { GameClient } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { disposeActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import type { AccountInterface } from "starknet";
import { create } from "zustand";

/**
 * The web client's handle on the game it booted. Bootstrap installs it once `createGameClient` resolves; the scenes
 * and panels act through it, the network status surface recovers through it, and a bootstrap reset disposes it.
 */
let activeGameClient: GameClient | null = null;
let unsubscribeAccount: (() => void) | null = null;

export const installActiveGameClient = (client: GameClient): void => {
  activeGameClient = client;
  followGameplayAccount(client);
};

/**
 * The gameplay account is identity-level: it is provisioned before any game boots and can rotate mid-game, so the
 * client follows the account store rather than taking a signer once at boot.
 */
const followGameplayAccount = (client: GameClient): void => {
  unsubscribeAccount?.();
  connectGameplayAccount(client, useAccountStore.getState().account);
  unsubscribeAccount = useAccountStore.subscribe((state, previous) => {
    if (state.account !== previous.account) connectGameplayAccount(client, state.account);
  });
};

const connectGameplayAccount = (client: GameClient, account: AccountInterface | null): void => {
  if (account) client.connect(account);
  else client.disconnect();
  // Connecting an account already left the stream's visit; the intent follows it.
  useRealmVisitStore.setState({ visit: null });
};

/** Another player's realm this client is viewing: the player Herald streams it for, and the realm to open. */
export interface RealmVisit {
  player: string;
  structureId: number;
}

const useRealmVisitStore = create<{ visit: RealmVisit | null }>(() => ({ visit: null }));

/**
 * The realm visit, the one source of the intent: the stream follows it (GameClient.visit) and the HUD reads it for
 * its banner. Read-only needs nothing here: opening a realm the player does not own already spectates it, which is
 * what the order gate reads.
 */
export const useRealmVisit = (): RealmVisit | null => useRealmVisitStore((state) => state.visit);

export const startRealmVisit = (visit: RealmVisit): void => {
  requireActiveGameClient().visit(visit.player);
  useRealmVisitStore.setState({ visit });
};

export const leaveRealmVisit = (): void => {
  if (!useRealmVisitStore.getState().visit) return;
  requireActiveGameClient().visit(null);
  useRealmVisitStore.setState({ visit: null });
};

export const requireActiveGameClient = (): GameClient => {
  if (!activeGameClient) throw new Error("No game client is active; bootstrap installs one before the game renders");
  return activeGameClient;
};

/** The store of the game this client plays, or null before a game boots; names read as unregistered until then. */
export const getActiveGameStore = (): NativeFactStore | null => activeGameClient?.setup.store ?? null;

/** The active game's facts, for a reader that only runs inside a game. */
export const requireActiveGameStore = (): NativeFactStore => {
  const store = getActiveGameStore();
  if (!store) throw new Error("No game is active to read its facts");
  return store;
};

export const disposeGameSyncSession = (): void => {
  unsubscribeAccount?.();
  unsubscribeAccount = null;
  useRealmVisitStore.setState({ visit: null });
  activeGameClient?.dispose();
  activeGameClient = null;
  // A bootstrap still inside createGameClient owns no handle yet; its runtime is the active one.
  disposeActiveGameSyncRuntime();
};

/** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
export const recoverGameSyncSession = async (): Promise<void> => {
  await requireActiveGameClient().recover();
};
