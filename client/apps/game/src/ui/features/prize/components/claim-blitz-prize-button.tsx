import { useAccountStore } from "@/hooks/store/use-account-store";
import { useUIStore } from "@/hooks/store/use-ui-store";
import Button from "@/ui/design-system/atoms/button";
import { useDojo } from "@bibliothecadao/react";
import { useEntityQuery } from "@dojoengine/react";
import { Has, getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@bibliothecadao/eternum";
import { useEffect, useMemo, useState } from "react";
import { belongsToActiveGame, configManager } from "@bibliothecadao/eternum";
import { shortString } from "starknet";
import { gameEntityKey } from "@/dojo/game-scope";

/**
 * Decode an ERC20 `symbol()` result. Handles the common felt252 short-string
 * shape and the ByteArray shape; returns null when nothing readable comes back
 * so the UI falls back to a neutral label.
 */
const decodeTokenSymbol = (raw: unknown): string | null => {
  const values = Array.isArray(raw) ? raw : [raw];
  try {
    const decodeFelt = (value: unknown): string => {
      try {
        const asBigInt = BigInt(String(value));
        if (asBigInt === 0n) return "";
        return shortString.decodeShortString(`0x${asBigInt.toString(16)}`);
      } catch {
        return "";
      }
    };

    if (values.length === 1) {
      const symbol = decodeFelt(values[0]).trim();
      return symbol.length > 0 ? symbol : null;
    }

    // ByteArray: [full_words_len, ...full_words, pending_word, pending_word_len]
    const fullWordsLength = Number(BigInt(String(values[0])));
    if (!Number.isFinite(fullWordsLength) || fullWordsLength < 0 || fullWordsLength + 3 !== values.length) return null;
    const words = values.slice(1, 1 + fullWordsLength + 1);
    const symbol = words.map(decodeFelt).join("").trim();
    return symbol.length > 0 ? symbol : null;
  } catch {
    return null;
  }
};

export const ClaimBlitzPrizeButton = ({ className }: { className?: string }) => {
  const {
    setup: {
      components,
      systemCalls: { blitz_prize_claim },
      network,
    },
  } = useDojo();

  const account = useAccountStore((state) => state.account);

  const [isLoading, setIsLoading] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);

  // Read finalized trial (single model)
  const finalEntities = useEntityQuery([Has(components.PlayersRankFinal)]);
  const final = useMemo(
    () =>
      finalEntities
        .map((entity) => getComponentValue(components.PlayersRankFinal, entity))
        .find((row) => belongsToActiveGame(row)),
    [finalEntities],
  );

  const finalTrialId = final?.trial_id as bigint | undefined;

  // Player rank for the connected account. s2 keys prize rows by
  // (game_id, ...) — the trial id only keys legacy (s1) worlds.
  const playerRank = useMemo(() => {
    if (!finalTrialId || !account?.address) return undefined;
    const eid =
      configManager.getActiveGameId() > 0
        ? gameEntityKey([BigInt(account.address)])
        : getEntityIdFromKeys([finalTrialId as unknown as bigint, BigInt(account.address)]);
    return getComponentValue(components.PlayerRank, eid as any);
  }, [components.PlayerRank, finalTrialId, account?.address]);

  const canClaim = Boolean(finalTrialId && playerRank && playerRank.rank > 0 && !playerRank.paid);

  const prizeShare = useMemo(() => {
    if (!finalTrialId || !playerRank) return undefined as undefined | bigint;
    try {
      const prizeId =
        configManager.getActiveGameId() > 0
          ? gameEntityKey([BigInt(playerRank.rank)])
          : getEntityIdFromKeys([finalTrialId as unknown as bigint, BigInt(playerRank.rank)]);
      const prize = getComponentValue(components.RankPrize, prizeId as any);
      if (!prize || Number(prize.total_players_same_rank_count) === 0) return undefined;
      const total: bigint = prize.total_prize_amount as bigint;
      return total / BigInt(prize.total_players_same_rank_count);
    } catch {
      return undefined;
    }
  }, [components.RankPrize, finalTrialId, playerRank?.rank]);

  // s2: the fee token lives on the ChainConfig singleton.
  const chainCfgEntities = useEntityQuery([Has(components.ChainConfig)]);
  const chainCfg = useMemo(
    () => (chainCfgEntities[0] ? getComponentValue(components.ChainConfig, chainCfgEntities[0]) : undefined),
    [chainCfgEntities],
  );
  const [decimals, setDecimals] = useState<number | null>(null);
  const [feeTokenSymbol, setFeeTokenSymbol] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const feeToken = chainCfg?.fee_token as unknown as string | undefined;
        const connectedAccount = account;
        if (!feeToken || !connectedAccount) return;
        const result: any = await network.provider.callAndReturnResult(connectedAccount, {
          contractAddress: feeToken,
          entrypoint: "decimals",
          calldata: [],
        } as any);
        const value = Array.isArray(result?.result) ? Number(result.result[0]) : Number(result);
        if (!Number.isNaN(value) && value >= 0) setDecimals(value);
      } catch (e) {
        // ignore
      }

      // Prize label comes from the chain's fee token; without one the UI keeps
      // a neutral "prize share" label instead of assuming LORDS.
      try {
        const feeToken = chainCfg?.fee_token as unknown as string | undefined;
        const connectedAccount = account;
        if (!feeToken || !connectedAccount) return;
        const result: any = await network.provider.callAndReturnResult(connectedAccount, {
          contractAddress: feeToken,
          entrypoint: "symbol",
          calldata: [],
        } as any);
        setFeeTokenSymbol(decodeTokenSymbol(Array.isArray(result?.result) ? result.result : result));
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, network.provider, chainCfg?.fee_token]);

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
    const connectedAccount = account;
    if (!canClaim || !connectedAccount) return;
    setIsLoading(true);
    try {
      await blitz_prize_claim({ signer: connectedAccount, players: [connectedAccount.address] });
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
                  {typeof prizeShare === "bigint" ? (
                    <span>{`${formatTokenAmount(prizeShare)} ${feeTokenSymbol ?? "prize share"}`}</span>
                  ) : (
                    formatTokenAmount(prizeShare)
                  )}
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
