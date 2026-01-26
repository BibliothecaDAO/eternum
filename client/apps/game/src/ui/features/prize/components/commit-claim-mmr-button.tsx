import Button from "@/ui/design-system/atoms/button";
import { displayAddress } from "@/ui/utils/utils";
import { toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { hash } from "starknet";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";

type PlayerMMR = { address: bigint; mmr: bigint };

// Batch size for JSON-RPC calls
const BATCH_SIZE = 20;

// Selector for get_player_mmr function
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");

export const CommitClaimMMRButton = ({ className }: { className?: string }) => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { commit_and_claim_game_mmr },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Get RPC URL from config
  const rpcUrl = useMemo(() => {
    return dojoConfig.rpcUrl || env.VITE_PUBLIC_NODE_URL;
  }, []);

  // Get WorldConfig to access MMR token address
  const worldCfgEntities = useEntityQuery([Has(components.WorldConfig)]);
  const worldCfg = useMemo(
    () => (worldCfgEntities[0] ? getComponentValue(components.WorldConfig, worldCfgEntities[0]) : undefined),
    [worldCfgEntities, components.WorldConfig],
  );

  // Check if MMR has already been committed (game_median is non-zero)
  const mmrGameMetaEntities = useEntityQuery([Has(components.MMRGameMeta)]);
  const mmrGameMeta = useMemo(
    () => (mmrGameMetaEntities[0] ? getComponentValue(components.MMRGameMeta, mmrGameMetaEntities[0]) : undefined),
    [mmrGameMetaEntities, components.MMRGameMeta],
  );
  const isMMRCommitted = useMemo(() => {
    const gameMedian = mmrGameMeta?.game_median as bigint | undefined;
    return gameMedian !== undefined && gameMedian !== 0n;
  }, [mmrGameMeta?.game_median]);

  const mmrTokenAddress = useMemo(() => {
    const addr = worldCfg?.mmr_config?.mmr_token_address as unknown as bigint | undefined;
    if (!addr || addr === 0n) return undefined;
    return toHexString(addr);
  }, [worldCfg?.mmr_config?.mmr_token_address]);

  const mmrEnabled = Boolean(worldCfg?.mmr_config?.enabled);

  // Get registered players from BlitzRealmPlayerRegister
  const blitzRegEntities = useEntityQuery([Has(components.BlitzRealmPlayerRegister)]);
  const registeredPlayers = useMemo(() => {
    return blitzRegEntities
      .map((eid) => getComponentValue(components.BlitzRealmPlayerRegister, eid))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .filter((v) => Boolean(v.once_registered))
      .map((v) => v.player as unknown as bigint);
  }, [blitzRegEntities, components.BlitzRealmPlayerRegister]);

  // Check if final ranking exists (MMR can only be claimed after final ranking)
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const hasFinal = useMemo(() => {
    const final = finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined;
    return Boolean(final?.trial_id && (final.trial_id as bigint) > 0n);
  }, [finalEntities, components.PlayersRankFinal]);

  const canCommitClaim = mmrEnabled && mmrTokenAddress && registeredPlayers.length >= 2 && hasFinal;

  /**
   * Fetch MMRs for a batch of players using JSON-RPC batch request
   */
  const fetchMMRBatch = async (players: bigint[], tokenAddress: string): Promise<PlayerMMR[]> => {
    // Create batch JSON-RPC request
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

    // Parse results - handle both array (batch) and single response
    const resultsArray = Array.isArray(results) ? results : [results];

    const playerMMRs: PlayerMMR[] = [];
    for (let idx = 0; idx < players.length; idx++) {
      const playerAddress = players[idx];
      const result = resultsArray.find((r: any) => r.id === idx);

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
  };

  const handleCommitClaim = async () => {
    if (!canCommitClaim || !mmrTokenAddress) return;
    setIsLoading(true);
    setStatus("Preparing...");

    try {
      // Chunk players into batches
      const playerChunks: bigint[][] = [];
      for (let i = 0; i < registeredPlayers.length; i += BATCH_SIZE) {
        playerChunks.push(registeredPlayers.slice(i, i + BATCH_SIZE));
      }

      const allPlayerMMRs: PlayerMMR[] = [];

      // Fetch MMRs in batches
      for (let chunkIdx = 0; chunkIdx < playerChunks.length; chunkIdx++) {
        const chunk = playerChunks[chunkIdx];
        setStatus(`Fetching MMRs: batch ${chunkIdx + 1}/${playerChunks.length} (${chunk.length} players)...`);

        const batchMMRs = await fetchMMRBatch(chunk, mmrTokenAddress);
        allPlayerMMRs.push(...batchMMRs);
      }

      setStatus("Sorting players by MMR...");

      // Sort players by MMR ascending (lowest MMR first)
      const sortedPlayers = allPlayerMMRs.sort((a, b) => {
        if (a.mmr < b.mmr) return -1;
        if (a.mmr > b.mmr) return 1;
        return 0;
      });

      const sortedAddresses = sortedPlayers.map((p) => toHexString(p.address));

      console.log("Sorted player addresses for MMR commit & claim:", sortedAddresses, sortedPlayers);

      setStatus(`Committing and claiming MMR for ${sortedAddresses.length} players...`);

      // Call commit and claim in single transaction
      await commit_and_claim_game_mmr({
        signer: account,
        players: sortedAddresses,
      });

      console.log("MMR Commit & Claim transaction submitted.");
      setStatus("Done");
      toast("MMR Commit & Claim submitted", {
        description: `Updated MMR for ${sortedAddresses.length} players.`,
      });
    } catch (e: any) {
      console.error("MMR Commit & Claim Failed", e);
      setStatus("Failed");
      toast("MMR Commit & Claim failed", { description: e?.message || String(e) });
    } finally {
      setIsLoading(false);
    }
  };

  if (!mmrEnabled || isMMRCommitted) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={canCommitClaim ? "primary" : "outline"}
        disabled={!canCommitClaim || isLoading}
        isLoading={isLoading}
        onClick={handleCommitClaim}
        className={className}
      >
        {!hasFinal ? "Finalize Ranking First" : registeredPlayers.length < 2 ? "Need 2+ Players" : "Update MMR"}
      </Button>
      {status && status !== "Done" && status !== "Failed" && <div className="text-xs text-gold/60">{status}</div>}
      {status === "Done" && <div className="text-xs text-brilliance">MMR updated successfully.</div>}
      {status === "Failed" && <div className="text-xs text-danger">Failed to update MMR.</div>}
      <div className="text-xs text-gold/50">
        {registeredPlayers.length} player{registeredPlayers.length !== 1 ? "s" : ""} registered
        {mmrTokenAddress && ` | Token: ${displayAddress(mmrTokenAddress)}`}
      </div>
    </div>
  );
};
