import { readGameEntry, type GameEntry } from "@realms-world/identity";
import { rpcAt, type LedgerGameKey } from "@realms-world/value-ledger";
import { relayOperation } from "./ports";
/** Entry terms identify the ledger and native game; clients resolve their tokens independently. */
export const paidGameEntry = (rpcUrl: string, address: string, key: LedgerGameKey) =>
  relayOperation("resolve paid game entry", async (): Promise<GameEntry> => {
    const chainId = await rpcAt(rpcUrl).getChainId();
    return readGameEntry({
      kind: "paid",
      ledger: { address, chainId, shard: key.chainId, gameId: key.gameId },
    });
  });
