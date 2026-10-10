import { Account, hash } from "starknet";
import { rpcAt, ledgerInteger, decodeBlitzSeason, readConfirmedLedgerHead } from "@realms-world/value-ledger";
import type { SeasonPorts } from "./season-tops";
interface Ledger {
  rpcUrl: string;
  contractAddress: string;
}
/** Both Workers enumerate the cohort independently; rankings always read the ledger's frozen season snapshot. */
export const seasonLedgerReads = (target: Ledger): Omit<SeasonPorts, "post" | "allocate"> => {
  const provider = rpcAt(target.rpcUrl);
  const eventPage = async (from: number, cursor: string | null, head: number, postsOnly: boolean) => {
    const names = postsOnly
      ? ["SeasonTopPosted", "SeasonTopBatchPosted"]
      : ["SeasonOpened", "ChestMinted", "SeasonMmrCorrected"];
    if (from > head) return { rows: [], head, next: null };
    const page = await provider.getEvents({
      address: target.contractAddress,
      from_block: { block_number: from },
      to_block: { block_number: head },
      keys: [names.map(hash.getSelectorFromName)],
      chunk_size: 100,
      ...(cursor ? { continuation_token: cursor } : {}),
    });
    const rows: Awaited<ReturnType<SeasonPorts["changes"]>>["rows"][number][] = [];
    for (const event of page.events) {
      if (
        BigInt(event.from_address) !== BigInt(target.contractAddress) ||
        event.block_number === undefined ||
        event.block_number < from ||
        event.block_number > head
      )
        throw new Error("invalid_season_event");
      const name = names.find((name) => BigInt(hash.getSelectorFromName(name)) === BigInt(event.keys[0] ?? "0"));
      if (name === "ChestMinted") {
        if (event.keys.length !== 4 || event.data.length !== 4) throw new Error("invalid_season_participant_event");
        rows.push({ kind: "participant", id: ledgerInteger(event.data[2]!), wallet: event.keys[3]! });
      } else {
        if (!name || event.keys.length !== 2) throw new Error("invalid_season_event");
        rows.push({
          kind:
            name === "SeasonTopPosted"
              ? "posted"
              : name === "SeasonTopBatchPosted"
                ? "proposed"
                : name === "SeasonOpened"
                  ? "opened"
                  : "corrected",
          id: ledgerInteger(event.keys[1]!),
          ...(name === "SeasonMmrCorrected" ? { revision: `${event.transaction_hash}:${event.block_number}` } : {}),
          ...(name === "SeasonTopPosted" ? { reviewUntil: ledgerInteger(event.data[1]!) } : {}),
        });
      }
    }
    return { rows, head, next: page.continuation_token || null };
  };
  return {
    head: () => readConfirmedLedgerHead(provider),
    blockHash: async (number) => (await readConfirmedLedgerHead(provider, number)).hash,
    changes: (from, cursor, head) => eventPage(from, cursor, head, false),
    posts: (from, cursor, head) => eventPage(from, cursor, head, true),
    season: async (id, head) => {
      const fields = await provider.callContract(
        { contractAddress: target.contractAddress, entrypoint: "get_season", calldata: [String(id)] },
        head,
      );
      const season = decodeBlitzSeason(fields);
      const preset = await provider.callContract(
        { contractAddress: target.contractAddress, entrypoint: "get_preset", calldata: [String(season.presetId)] },
        head,
      );
      if (preset.length !== 21) throw new Error("invalid_season_preset");
      const paidFraction = ledgerInteger(preset[4]!);
      if (paidFraction <= 0 || paidFraction > 10000) throw new Error("invalid_season_paid_fraction");
      const settlement = await provider.callContract(
        { contractAddress: target.contractAddress, entrypoint: "season_settlement", calldata: [String(id)] },
        head,
      );
      if (settlement.length !== 7) throw new Error("invalid_season_settlement");
      return { ...season, id, paidFraction, allocationCursor: ledgerInteger(settlement[4]!) };
    },
    mmr: async (id, wallet, head) => {
      const fields = await provider.callContract(
        { contractAddress: target.contractAddress, entrypoint: "get_season_mmr", calldata: [String(id), wallet] },
        head,
      );
      if (fields.length !== 1) throw new Error("invalid_season_mmr");
      return fields[0]!;
    },
    winner: async (id, index, head) => {
      const fields = await provider.callContract(
        {
          contractAddress: target.contractAddress,
          entrypoint: "get_season_winner",
          calldata: [String(id), String(index)],
        },
        head,
      );
      if (fields.length !== 3 || BigInt(fields[0]!) === 0n) throw new Error("invalid_season_winner");
      return fields[0]!;
    },
  };
};
export const postSeasonTop = async (
  target: Ledger & { accountAddress: string; privateKey: string },
  id: number,
  start: number,
  wallets: readonly string[],
) => {
  const provider = rpcAt(target.rpcUrl);
  const account = new Account({ provider, address: target.accountAddress, signer: target.privateKey });
  const tx = await account.execute({
    contractAddress: target.contractAddress,
    entrypoint: "post_season_top",
    calldata: [String(id), String(start), String(wallets.length), ...wallets],
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash);
  if (receipt.isReverted()) throw new Error("season_top_post_reverted");
  const season = decodeBlitzSeason(
    await provider.callContract(
      { contractAddress: target.contractAddress, entrypoint: "get_season", calldata: [String(id)] },
      "latest",
    ),
  );
  if (!season.posted || season.challenged || season.topCount < start + wallets.length)
    throw new Error("season_top_not_recorded");
};

export const allocateSeason = async (
  target: Ledger & { accountAddress: string; privateKey: string },
  id: number,
  start: number,
) => {
  const provider = rpcAt(target.rpcUrl);
  const account = new Account({ provider, address: target.accountAddress, signer: target.privateKey });
  const tx = await account.execute({
    contractAddress: target.contractAddress,
    entrypoint: "allocate_season",
    calldata: [String(id), String(start)],
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash);
  if (receipt.isReverted()) throw new Error("season_allocation_reverted");
  const fields = await provider.callContract(
    { contractAddress: target.contractAddress, entrypoint: "season_settlement", calldata: [String(id)] },
    "latest",
  );
  if (fields.length !== 7) throw new Error("invalid_season_settlement");
  return ledgerInteger(fields[4]!);
};
