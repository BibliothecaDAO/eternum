import { useAccountStore } from "@/hooks/store/use-account-store";
import type { GameClient } from "@bibliothecadao/eternum";
import { disposeActiveGameSyncRuntime } from "@bibliothecadao/eternum/game-sync";
import type { AccountInterface } from "starknet";

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
};

export const requireActiveGameClient = (): GameClient => {
  if (!activeGameClient) throw new Error("No game client is active; bootstrap installs one before the game renders");
  return activeGameClient;
};

export const disposeGameSyncSession = (): void => {
  unsubscribeAccount?.();
  unsubscribeAccount = null;
  activeGameClient?.dispose();
  activeGameClient = null;
  // A bootstrap still inside createGameClient owns no handle yet; its runtime is the active one.
  disposeActiveGameSyncRuntime();
};

/** Reconnect through the same convergent subscribe → snapshot → replay routine used at boot. */
export const recoverGameSyncSession = async (): Promise<void> => {
  await requireActiveGameClient().recover();
};
