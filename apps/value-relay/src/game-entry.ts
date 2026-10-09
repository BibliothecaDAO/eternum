import { readGameEntry, type GameEntry } from "@realms-world/identity";
import { rpcAt, type LedgerGameKey } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";
/** Resolve the actual L2 network and configured network-fee token once, alongside the confirmed opening. */
export const paidGameEntry = (rpcUrl: string, address: string, feeToken: string, key: LedgerGameKey) =>
  relayOperation("resolve paid game entry", async (): Promise<GameEntry> => {
    const chainId = await rpcAt(rpcUrl).getChainId();
    return readGameEntry({
      kind: "paid",
      ledger: { address, chainId, feeToken, shard: key.chainId, gameId: key.gameId },
    });
  });
