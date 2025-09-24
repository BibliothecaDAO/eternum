import Button from "@/ui/design-system/atoms/button";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useMemo, useState } from "react";

export const ClaimBlitzPrizeButton = ({ className }: { className?: string }) => {
  const {
    account: { account },
    setup: {
      components,
      systemCalls: { blitz_prize_claim },
      network,
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // Read finalized trial (single model)
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const final = useMemo(
    () => (finalEntities[0] ? getComponentValue(components.PlayersRankFinal, finalEntities[0]) : undefined),
    [finalEntities],
  );

  const finalTrialId = final?.trial_id as bigint | undefined;

  // Player rank for the connected account
  const playerRank = useMemo(() => {
    if (!finalTrialId || !account?.address) return undefined;
    const eid = getEntityIdFromKeys([finalTrialId as unknown as bigint, BigInt(account.address)]);
    return getComponentValue(components.PlayerRank, eid as any);
  }, [components.PlayerRank, finalTrialId, account?.address]);

  const canClaim = Boolean(finalTrialId && playerRank && playerRank.rank > 0 && !playerRank.paid);

  const prizeShare = useMemo(() => {
    if (!finalTrialId || !playerRank) return undefined as undefined | bigint;
    try {
      const prizeId = getEntityIdFromKeys([finalTrialId as unknown as bigint, BigInt(playerRank.rank)]);
      const prize = getComponentValue(components.RankPrize, prizeId as any);
      if (!prize || Number(prize.total_players_same_rank_count) === 0) return undefined;
      const total: bigint = prize.total_prize_amount as bigint;
      return total / BigInt(prize.total_players_same_rank_count);
    } catch {
      return undefined;
    }
  }, [components.RankPrize, finalTrialId, playerRank?.rank]);

  // Fetch decimals from WorldConfig->blitz_registration_config.fee_token
  const worldCfgEntities = useEntityQuery([Has(components.WorldConfig)]);
  const worldCfg = useMemo(
    () => (worldCfgEntities[0] ? getComponentValue(components.WorldConfig, worldCfgEntities[0]) : undefined),
    [worldCfgEntities],
  );
  const [decimals, setDecimals] = useState<number | null>(null);
  useMemo(() => {
    (async () => {
      try {
        const feeToken = worldCfg?.blitz_registration_config?.fee_token as unknown as string | undefined;
        if (!feeToken) return;
        const result: any = await network.provider.callAndReturnResult(account, {
          contractAddress: feeToken,
          entrypoint: "decimals",
          calldata: [],
        } as any);
        const value = Array.isArray(result?.result) ? Number(result.result[0]) : Number(result);
        if (!Number.isNaN(value) && value >= 0) setDecimals(value);
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldCfg?.blitz_registration_config?.fee_token]);

  const formatTokenAmount = (amount?: bigint) => {
    if (typeof amount !== "bigint") return "-";
    if (decimals == null) return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const d = decimals;
    const s = amount.toString();
    const pad = d - s.length;
    const whole = pad >= 0 ? "0" : s.slice(0, s.length - d);
    const fracRaw = pad >= 0 ? "0".repeat(pad) + s : s.slice(s.length - d);
    const wholeFmt = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    const frac = fracRaw.replace(/0+$/, "");
    return frac.length > 0 ? `${wholeFmt}.${frac}` : wholeFmt;
  };

  const onClaim = async () => {
    if (!canClaim) return;
    setIsLoading(true);
    try {
      await blitz_prize_claim({ signer: account, players: [account.address] });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={canClaim ? "primary" : "outline"}
      disabled={!canClaim}
      isLoading={isLoading}
      onClick={onClaim}
      className={className}
      onMouseOver={() => {
        setTooltip({
          position: "bottom",
          content: (
            <div className="flex flex-col whitespace-nowrap pointer-events-none text-center">
              <span className="font-bold text-gold mb-1">Prize Claim</span>
              <span className="flex justify-between gap-4">
                <span>Rank:</span>
                <span className="text-green-400">{playerRank?.rank ?? "-"}</span>
              </span>
              <span className="flex justify-between gap-4">
                <span>Share:</span>
              <span className={prizeShare ? "text-yellow-400" : "text-gray-400"}>
                  {formatTokenAmount(prizeShare)}
              </span>
              </span>
            </div>
          ),
        });
      }}
      onMouseOut={() => setTooltip(null)}
    >
      {playerRank?.paid ? "Prize Claimed" : "Claim Blitz Prize"}
    </Button>
  );
};
