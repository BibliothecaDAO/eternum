import { displayAddress } from "@/ui/utils/utils";
import { getAddressName, toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { ContractAddress } from "@bibliothecadao/types";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, Has } from "@dojoengine/recs";
import { useEffect, useMemo, useState } from "react";
import { hash } from "starknet";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";

type PlayerMMR = { address: bigint; mmr: bigint };

// MMR Tier definitions
type MMRTier = {
  name: string;
  minMMR: number;
  maxMMR: number;
  color: string;
};

const MMR_TIERS: MMRTier[] = [
  { name: "Elite", minMMR: 2850, maxMMR: Infinity, color: "text-purple-400" },
  { name: "Master", minMMR: 2400, maxMMR: 2850, color: "text-red-400" },
  { name: "Diamond", minMMR: 1950, maxMMR: 2400, color: "text-cyan-400" },
  { name: "Platinum", minMMR: 1500, maxMMR: 1950, color: "text-emerald-400" },
  { name: "Gold", minMMR: 1050, maxMMR: 1500, color: "text-yellow-400" },
  { name: "Silver", minMMR: 600, maxMMR: 1050, color: "text-gray-300" },
  { name: "Bronze", minMMR: 150, maxMMR: 600, color: "text-orange-400" },
  { name: "Iron", minMMR: 0, maxMMR: 150, color: "text-stone-500" },
];

const getMMRTier = (mmr: number): MMRTier => {
  for (const tier of MMR_TIERS) {
    if (mmr >= tier.minMMR) {
      return tier;
    }
  }
  return MMR_TIERS[MMR_TIERS.length - 1]; // Iron as fallback
};

// Batch size for JSON-RPC calls
const BATCH_SIZE = 20;

// Selector for get_player_mmr function
const GET_PLAYER_MMR_SELECTOR = hash.getSelectorFromName("get_player_mmr");

export const BlitzMMRTable = () => {
  const {
    setup: { components },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(true);
  const [playerMMRs, setPlayerMMRs] = useState<PlayerMMR[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  const mmrTokenAddress = useMemo(() => {
    const addr = worldCfg?.mmr_config?.mmr_token_address as unknown as bigint | undefined;
    if (!addr || addr === 0n) return undefined;
    return toHexString(addr);
  }, [worldCfg?.mmr_config?.mmr_token_address]);

  // Get registered players from BlitzRealmPlayerRegister
  const blitzRegEntities = useEntityQuery([Has(components.BlitzRealmPlayerRegister)]);
  const registeredPlayerAddresses = useMemo(() => {
    return blitzRegEntities
      .map((eid) => getComponentValue(components.BlitzRealmPlayerRegister, eid))
      .filter((v): v is NonNullable<typeof v> => Boolean(v))
      .filter((v) => Boolean(v.once_registered))
      .map((v) => v.player as unknown as bigint);
  }, [blitzRegEntities, components.BlitzRealmPlayerRegister]);

  // Get player points and filter to only players with non-zero points
  const playerRegisteredPointsEntities = useEntityQuery([Has(components.PlayerRegisteredPoints)]);
  const playerPointsByPlayer = useMemo(() => {
    const points = new Map<bigint, bigint>();
    playerRegisteredPointsEntities.forEach((eid) => {
      const value = getComponentValue(components.PlayerRegisteredPoints, eid);
      if (!value) return;
      points.set(value.address as unknown as bigint, value.registered_points as bigint);
    });
    return points;
  }, [playerRegisteredPointsEntities, components.PlayerRegisteredPoints]);

  // Only include registered players with non-zero points
  const registeredPlayers = useMemo(() => {
    return registeredPlayerAddresses.filter((addr) => {
      const points = playerPointsByPlayer.get(addr);
      return points !== undefined && points > 0n;
    });
  }, [registeredPlayerAddresses, playerPointsByPlayer]);

  /**
   * Fetch MMRs for a batch of players using JSON-RPC batch request
   */
  const fetchMMRBatch = async (players: bigint[], tokenAddress: string): Promise<PlayerMMR[]> => {
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

  // Fetch all player MMRs on mount or when dependencies change
  useEffect(() => {
    if (!mmrTokenAddress || registeredPlayers.length === 0) {
      setIsLoading(false);
      return;
    }

    const fetchAllMMRs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Chunk players into batches
        const playerChunks: bigint[][] = [];
        for (let i = 0; i < registeredPlayers.length; i += BATCH_SIZE) {
          playerChunks.push(registeredPlayers.slice(i, i + BATCH_SIZE));
        }

        const allPlayerMMRs: PlayerMMR[] = [];

        for (const chunk of playerChunks) {
          const batchMMRs = await fetchMMRBatch(chunk, mmrTokenAddress);
          allPlayerMMRs.push(...batchMMRs);
        }

        // Sort by MMR descending (highest first)
        allPlayerMMRs.sort((a, b) => {
          if (a.mmr > b.mmr) return -1;
          if (a.mmr < b.mmr) return 1;
          return 0;
        });

        setPlayerMMRs(allPlayerMMRs);
      } catch (e: any) {
        console.error("Failed to fetch player MMRs:", e);
        setError(e?.message || String(e));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllMMRs();
  }, [mmrTokenAddress, registeredPlayers, rpcUrl]);

  // Format MMR for display (convert from token units with 18 decimals)
  const formatMMR = (mmr: bigint): string => {
    const mmrValue = mmr / 10n ** 18n;
    return mmrValue.toString();
  };

  // Helper to get player display name
  const getPlayerDisplayName = (playerAddress: bigint): string => {
    const name = getAddressName(ContractAddress(playerAddress), components);
    return name || displayAddress(toHexString(playerAddress));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-4 text-gold/60 text-sm">Loading player MMRs...</div>;
  }

  if (error) {
    return (
      <div className="rounded-md bg-danger/15 border border-danger/40 text-danger p-2 text-xs">
        Failed to load MMRs: {error}
      </div>
    );
  }

  if (playerMMRs.length === 0) {
    return <div className="flex items-center justify-center p-4 text-gold/60 text-sm">No player MMRs available</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[700px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-dark/90">
            <tr className="text-gold/70 border-b border-gold/10">
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Player</th>
              <th className="text-center py-2 px-2">Tier</th>
              <th className="text-right py-2 px-2">MMR</th>
            </tr>
          </thead>
          <tbody>
            {playerMMRs.map((player, idx) => {
              const mmrValue = Number(player.mmr / 10n ** 18n);
              const tier = getMMRTier(mmrValue);
              return (
                <tr key={toHexString(player.address)} className="border-b border-gold/5 hover:bg-gold/5">
                  <td className="py-2 px-2 text-gold/50">{idx + 1}</td>
                  <td className="py-2 px-2 text-gold/80">{getPlayerDisplayName(player.address)}</td>
                  <td className={`py-2 px-2 text-center font-medium ${tier.color}`}>{tier.name}</td>
                  <td className="py-2 px-2 text-right text-gold font-medium">{formatMMR(player.mmr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-gold/50 text-center">
        {playerMMRs.length} player{playerMMRs.length !== 1 ? "s" : ""} ranked by MMR
      </div>
    </div>
  );
};
