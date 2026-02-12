import Button from "@/ui/design-system/atoms/button";
import { displayAddress } from "@/ui/utils/utils";
import { toHexString } from "@bibliothecadao/eternum";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { dojoConfig } from "../../../../../dojo-config";
import { env } from "../../../../../env";
import { commitAndClaimMMR } from "../utils/mmr-utils";

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

  // Get minimum players required from config (default to 6 if not set)
  const minPlayers = Number(worldCfg?.mmr_config?.min_players ?? 6);

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

  // Check if final ranking exists (MMR can only be claimed after final ranking)
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const hasFinal = useMemo(() => {
    const final = finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined;
    return Boolean(final?.trial_id && (final.trial_id as bigint) > 0n);
  }, [finalEntities, components.PlayersRankFinal]);

  const hasEnoughPlayers = registeredPlayers.length >= minPlayers;
  const canCommitClaim = mmrEnabled && mmrTokenAddress && hasEnoughPlayers && hasFinal;

  const handleCommitClaim = async () => {
    if (!canCommitClaim || !mmrTokenAddress) return;
    setIsLoading(true);
    setStatus("Preparing...");

    try {
      const sortedAddresses = await commitAndClaimMMR({
        registeredPlayers,
        mmrTokenAddress,
        rpcUrl,
        commitAndClaimGameMmr: commit_and_claim_game_mmr,
        signer: account,
        onStatusChange: setStatus,
      });

      setStatus("Done");
      toast("MMR Commit & Claim submitted", {
        description: `Updated MMR for ${sortedAddresses.length} players.`,
      });
    } catch (e: unknown) {
      console.error("MMR Commit & Claim Failed", e);
      setStatus("Failed");
      const errorMessage = e instanceof Error ? e.message : String(e);
      toast("MMR Commit & Claim failed", { description: errorMessage });
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
        {!hasFinal ? "Finalize Ranking First" : !hasEnoughPlayers ? `Need ${minPlayers}+ Players` : "Update MMR"}
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
