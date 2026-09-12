import type { AccountInterface } from "starknet";

import type { GameClient } from "../game-client";

/** What an action needs from the client: the world's components and system calls, and who signs. */
export type ActionClient = Pick<GameClient, "setup" | "signer">;

/** The same world acted on by another account: one client, many actors, as the lab harness plays its bots. */
export const actingAs = (client: ActionClient, signer: AccountInterface): ActionClient => ({
  setup: client.setup,
  signer,
});

/** Every submit signs with the connected account; a client that never connected cannot act, and says so. */
export const requireSigner = (client: ActionClient): AccountInterface => {
  if (!client.signer) {
    throw new Error("GameClient has no signer: call client.connect(signer) before submitting actions");
  }
  return client.signer;
};
