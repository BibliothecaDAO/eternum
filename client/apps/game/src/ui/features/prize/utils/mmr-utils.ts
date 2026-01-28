import { toHexString } from "@bibliothecadao/eternum";
import { Account, AccountInterface, hash } from "starknet";

type PlayerMMR = { address: bigint; mmr: bigint };

type JsonRpcResult = {
  id: number;
  error?: unknown;
  result?: string[];
};

// Batch size for JSON-RPC calls
const BATCH_SIZE = 20;

// Selector for get_player_mmr function
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");

/**
 * Fetch MMRs for a batch of players using JSON-RPC batch request
 */
async function fetchMMRBatch(players: bigint[], tokenAddress: string, rpcUrl: string): Promise<PlayerMMR[]> {
  const batchRequest = players.map((playerAddress, idx) => ({
    jsonrpc: "2.0",
    id: idx,
    method: "starknet_call",
    params: [
      {
        contract_address: tokenAddress,
        entry_point_selector: GET_PLAYER_MMR_SELECTOR,
        calldata: [toHexString(playerAddress)],
      },
      "pre_confirmed",
    ],
  }));

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(batchRequest),
  });

  if (!response.ok) {
    throw new Error(`RPC request failed: ${response.status}`);
  }

  const results = await response.json();
  const resultsArray = Array.isArray(results) ? results : [results];

  const playerMMRs: PlayerMMR[] = [];
  for (let idx = 0; idx < players.length; idx++) {
    const playerAddress = players[idx];
    const result = resultsArray.find((r: JsonRpcResult) => r.id === idx);

    if (result?.error) {
      throw new Error(`Failed to fetch MMR for ${toHexString(playerAddress)}: ${JSON.stringify(result.error)}`);
    }

    if (!result?.result) {
      throw new Error(`No result for player ${toHexString(playerAddress)}`);
    }

    // u256 is returned as two felts [low, high]
    const resultArray = result.result;
    const low = BigInt(resultArray[0] || "0");
    const high = BigInt(resultArray[1] || "0");
    const mmr = low + (high << 128n);
    playerMMRs.push({ address: playerAddress, mmr });
  }

  return playerMMRs;
}

export type CommitClaimMMRParams = {
  registeredPlayers: bigint[];
  mmrTokenAddress: string;
  rpcUrl: string;
  commitAndClaimGameMmr: (params: { signer: AccountInterface | Account; players: string[] }) => Promise<unknown>;
  signer: AccountInterface | Account;
  onStatusChange?: (status: string) => void;
};

/**
 * Fetches player MMRs, sorts them, and calls commit_and_claim_game_mmr
 * Returns the sorted player addresses that were submitted
 */
export async function commitAndClaimMMR(params: CommitClaimMMRParams): Promise<string[]> {
  const { registeredPlayers, mmrTokenAddress, rpcUrl, commitAndClaimGameMmr, signer, onStatusChange } = params;

  // Note: Callers should check min_players from mmr_config before calling this function
  if (registeredPlayers.length === 0) {
    throw new Error("No players to commit MMR for");
  }

  onStatusChange?.("Fetching player MMRs...");

  // Chunk players into batches
  const playerChunks: bigint[][] = [];
  for (let i = 0; i < registeredPlayers.length; i += BATCH_SIZE) {
    playerChunks.push(registeredPlayers.slice(i, i + BATCH_SIZE));
  }

  const allPlayerMMRs: PlayerMMR[] = [];

  // Fetch MMRs in batches
  for (let chunkIdx = 0; chunkIdx < playerChunks.length; chunkIdx++) {
    const chunk = playerChunks[chunkIdx];
    onStatusChange?.(`Fetching MMRs: batch ${chunkIdx + 1}/${playerChunks.length} (${chunk.length} players)...`);

    const batchMMRs = await fetchMMRBatch(chunk, mmrTokenAddress, rpcUrl);
    allPlayerMMRs.push(...batchMMRs);
  }

  onStatusChange?.("Sorting players by MMR...");

  // Sort players by MMR ascending (lowest MMR first) - contract requires this
  const sortedPlayers = allPlayerMMRs.toSorted((a, b) => {
    if (a.mmr < b.mmr) return -1;
    if (a.mmr > b.mmr) return 1;
    return 0;
  });

  const sortedAddresses = sortedPlayers.map((p) => toHexString(p.address));

  console.log("Sorted player addresses for MMR commit & claim:", sortedAddresses, sortedPlayers);

  onStatusChange?.(`Committing and claiming MMR for ${sortedAddresses.length} players...`);

  // Call commit and claim in single transaction
  await commitAndClaimGameMmr({
    signer,
    players: sortedAddresses,
  });

  console.log("MMR Commit & Claim transaction submitted.");

  return sortedAddresses;
}
