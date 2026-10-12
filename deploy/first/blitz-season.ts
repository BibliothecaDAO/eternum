import type { RpcProvider } from "starknet";
import { decodeBlitzSeason } from "../../packages/value-ledger/src/codecs";
import { isContractRevert } from "./chain";
import { PublicError } from "./errors";

/** The ledger owns season numbering; only an ended window permits another season. */
export async function resolveBlitzSeason(provider: RpcProvider, ledger: string, start: number, end: number) {
  const head = await provider.getBlockWithTxHashes("latest");
  if (!("block_number" in head)) throw new PublicError("Confirmed mainnet head required");
  let matching: number | undefined;
  for (let id = 1; ; id++) {
    let fields: string[];
    try {
      fields = await provider.callContract(
        { contractAddress: ledger, entrypoint: "get_season", calldata: [String(id)] },
        head.block_number!,
      );
    } catch (error) {
      if (!isContractRevert(error, "Ledger: unknown Blitz season")) throw error;
      return { id: matching ?? id, present: matching !== undefined, head: head.block_number!, now: head.timestamp };
    }
    const season = decodeBlitzSeason(fields);
    if (season.start === start && season.end === end) matching = id;
    else if (season.end > head.timestamp)
      throw new PublicError("A running or future Blitz season has different dates; no season was changed");
  }
}
