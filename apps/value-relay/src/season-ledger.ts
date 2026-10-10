import { Account, hash } from "starknet";
import {
  readLedgerGame,
  rpcAt,
  ledgerInteger,
  decodeBlitzSeason,
  decodeLedgerPreset,
  readConfirmedLedgerHead,
} from "@realms-world/value-ledger";
import type { SeasonPorts } from "./season-tops";
interface Ledger {
  rpcUrl: string;
  contractAddress: string;
}
/** Both Workers enumerate the cohort independently; rankings always read the ledger's frozen season snapshot. */
export const seasonLedgerReads = (target: Ledger): Omit<SeasonPorts, "post" | "challenge"> => {
  const provider = rpcAt(target.rpcUrl);
  return {
    game: async (key, head) => {
      const game = await readLedgerGame(provider, target.contractAddress, key, head);
      return { id: game.seasonId, terminal: game.cancelled || game.finalized };
    },
    head: () => readConfirmedLedgerHead(provider),
    blockHash: async (number) => (await readConfirmedLedgerHead(provider, number)).hash,
    changes: (from, cursor, head) => readSeasonEventPage(target, from, cursor, head, false),
    posts: (from, cursor, head) => readSeasonEventPage(target, from, cursor, head, true),
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
      const { paidFraction } = decodeLedgerPreset(preset);
      if (paidFraction <= 0 || paidFraction > 10000) throw new Error("invalid_season_paid_fraction");
      return { ...season, id, paidFraction };
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
  wallets: readonly string[],
) => {
  const provider = rpcAt(target.rpcUrl);
  const account = new Account({ provider, address: target.accountAddress, signer: target.privateKey });
  const tx = await account.execute({
    contractAddress: target.contractAddress,
    entrypoint: "post_season_top",
    calldata: [String(id), String(wallets.length), ...wallets],
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash);
  if (receipt.isReverted()) throw new Error("season_top_post_reverted");
  const season = decodeBlitzSeason(
    await provider.callContract(
      { contractAddress: target.contractAddress, entrypoint: "get_season", calldata: [String(id)] },
      "latest",
    ),
  );
  if (!season.posted || season.challenged || season.topCount !== wallets.length)
    throw new Error("season_top_not_recorded");
};

export const challengeSeason = async (
  target: Ledger & { accountAddress: string; privateKey: string },
  id: number,
  omitted: string,
) => {
  const provider = rpcAt(target.rpcUrl);
  const account = new Account({ provider, address: target.accountAddress, signer: target.privateKey });
  const tx = await account.execute({
    contractAddress: target.contractAddress,
    entrypoint: "challenge_season",
    calldata: [String(id), omitted],
  });
  const receipt = await provider.waitForTransaction(tx.transaction_hash);
  if (receipt.isReverted()) throw new Error("season_challenge_reverted");
  const season = decodeBlitzSeason(
    await provider.callContract(
      { contractAddress: target.contractAddress, entrypoint: "get_season", calldata: [String(id)] },
      "latest",
    ),
  );
  if (!season.challenged) throw new Error("season_challenge_not_recorded");
};

const readSeasonEventPage = async (
  target: Ledger,
  from: number,
  cursor: string | null,
  head: number,
  postsOnly: boolean,
) => {
  const provider = rpcAt(target.rpcUrl);
  const names = postsOnly
    ? ["SeasonTopPosted"]
    : [
        "SeasonOpened",
        "ChestMinted",
        "SeasonMmrCorrected",
        "GameOpened",
        "ResultsApplied",
        "GameCancelled",
        "GameAborted",
      ];
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
    if (["GameOpened", "ResultsApplied", "GameCancelled", "GameAborted"].includes(name ?? "")) {
      if (event.keys.length !== 3) throw new Error("invalid_season_game_event");
      const key = { chainId: event.keys[1]!, gameId: ledgerInteger(event.keys[2]!) };
      const game = await readLedgerGame(provider, target.contractAddress, key, head);
      rows.push({
        kind: "game",
        id: game.seasonId,
        key,
        terminal: game.cancelled || game.finalized,
        ...(name === "ResultsApplied" ? { revision: `${event.transaction_hash}:${event.block_number}` } : {}),
      });
    } else if (name === "ChestMinted") {
      if (event.keys.length !== 4 || event.data.length !== 4) throw new Error("invalid_season_participant_event");
      rows.push({ kind: "participant", id: ledgerInteger(event.data[2]!), wallet: event.keys[3]! });
    } else {
      if (!name || event.keys.length !== 2) throw new Error("invalid_season_event");
      rows.push({
        kind: name === "SeasonTopPosted" ? "posted" : name === "SeasonOpened" ? "opened" : "corrected",
        id: ledgerInteger(event.keys[1]!),
        ...(name !== "SeasonOpened"
          ? {
              revision: `${event.transaction_hash}:${event.block_number}:${event.keys.join(":")}:${event.data.join(":")}`,
            }
          : {}),
        ...(name === "SeasonTopPosted" ? { reviewUntil: ledgerInteger(event.data[1]!) } : {}),
      });
    }
  }
  return { rows, head, next: page.continuation_token || null };
};
