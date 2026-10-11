import type { RpcProvider } from "starknet";
import { ledgerInteger } from "./codecs";

/** Games serializes each RosterPlayer as account then wallet; both readers use a checked confirmed head. */
export async function readBlitzRoster(provider: RpcProvider, gamesAddress: string, gameId: number, head: number) {
  const fields = await provider.callContract(
    { contractAddress: gamesAddress, entrypoint: "blitz_roster", calldata: [String(gameId)] },
    head,
  );
  const count = ledgerInteger(fields[0]!);
  if (fields.length !== 1 + count * 2) throw new Error("invalid_frozen_roster");
  return Array.from({ length: count }, (_, index) => ({
    account: fields[1 + index * 2]!,
    wallet: fields[2 + index * 2]!,
  }));
}
