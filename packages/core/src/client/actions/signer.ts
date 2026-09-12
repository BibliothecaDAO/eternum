import type { AccountInterface } from "starknet";

import type { GameClient } from "../game-client";

/** Every submit signs with the connected account; a client that never connected cannot act, and says so. */
export const requireSigner = (client: GameClient): AccountInterface => {
  if (!client.signer) {
    throw new Error("GameClient has no signer: call client.connect(signer) before submitting actions");
  }
  return client.signer;
};
