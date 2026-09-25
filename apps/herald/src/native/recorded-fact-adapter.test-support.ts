import { hash, shortString } from "starknet";
import type { RpcReceipt } from "../types";

export const retiredMetadataModels = [
  "RealmCatalogue",
  "Authentication",
  "GameSequence",
  "EntitySequence",
  "LedgerOperator",
] as const;
const retired = new Set(retiredMetadataModels.map((name) => BigInt(shortString.encodeShortString(name))));
const rowSet = BigInt(hash.getSelectorFromName("RowSet"));

/** The preserved pre-A7 receipts contain these metadata rows; their gameplay facts are replayed unchanged. */
export function withoutRetiredMetadata(recorded: RpcReceipt): RpcReceipt {
  return {
    ...recorded,
    events: recorded.events.filter((event) => {
      const prefix = event.keys.findIndex((key) => BigInt(key) === rowSet);
      return prefix < 0 || !retired.has(BigInt(event.keys[prefix + 2]!));
    }),
  };
}
