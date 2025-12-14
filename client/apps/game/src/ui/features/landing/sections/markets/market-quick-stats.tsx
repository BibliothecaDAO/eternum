import { useMemo } from "react";

import { getContractByName } from "@dojoengine/core";
import { Clock3, Lock, Users, Wallet } from "lucide-react";
import { useAccount } from "@starknet-react/core";

import type { MarketClass } from "@/pm/class";
import { useDojoSdk } from "@/pm/hooks/dojo/useDojoSdk";
import { useTokens } from "@/pm/hooks/dojo/useTokens";
import { useClaimablePayout } from "@/pm/hooks/markets/useClaimablePayout";
import { formatUnits } from "@/pm/utils";

import { TokenIcon } from "./TokenIcon";

const formatTimeLeft = (targetSeconds: number | null) => {
  if (targetSeconds == null || targetSeconds <= 0) return "N/A";
  const nowSec = Math.floor(Date.now() / 1_000);
  const diff = targetSeconds - nowSec;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86_400);
  const hours = Math.floor((diff % 86_400) / 3_600);
  const minutes = Math.floor((diff % 3_600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

export const MarketQuickStats = ({ market }: { market: MarketClass }) => {
  const { account } = useAccount();
  const {
    config: { manifest },
  } = useDojoSdk();

  const positionIds = useMemo(() => (market.position_ids || []).map((id) => BigInt(id || 0)), [market.position_ids]);
  const positionIdsAsStrings = useMemo(() => positionIds.map((id) => id.toString()), [positionIds]);

  const vaultPositionsAddress = useMemo(() => getContractByName(manifest, "pm", "VaultPositions")?.address, [manifest]);

  const { balances } = useTokens(
    {
      accountAddresses: undefined,
      contractAddresses: vaultPositionsAddress ? [vaultPositionsAddress] : [],
      // tokenIds: positionIdsAsStrings,
    },
    false,
  );

  const holdersCount = useMemo(() => {
    if (!vaultPositionsAddress || positionIds.length === 0) return null;
    const holders = new Set<string>();

    balances.forEach((balance) => {
      if (BigInt(balance.balance || 0) === 0n) return;
      const isPositionToken = positionIds.some((id) => BigInt(balance.token_id || 0) === id);
      if (!isPositionToken) return;
      holders.add(balance.account_address);
    });

    return holders.size;
  }, [balances, positionIds, vaultPositionsAddress]);

  const playerLockedAmount = useMemo(() => {
    if (!account?.address || !vaultPositionsAddress || positionIds.length === 0) return null;

    const total = balances.reduce((acc, balance) => {
      const matchesPlayer = BigInt(balance.account_address) === BigInt(account.address);
      const matchesContract = BigInt(balance.contract_address) === BigInt(vaultPositionsAddress);
      const matchesToken = positionIds.some((id) => BigInt(balance.token_id || 0) === id);

      if (!matchesPlayer || !matchesContract || !matchesToken) return acc;

      return acc + BigInt(balance.balance || 0);
    }, 0n);

    return formatUnits(total, Number(market.collateralToken?.decimals ?? 0), 4);
  }, [account?.address, balances, market.collateralToken?.decimals, positionIds, vaultPositionsAddress]);

  const tvl = market.getTvl ? market.getTvl() : (market.tvl ?? 0);
  const tradingEndsLabel = formatTimeLeft(market.end_at ?? null);

  const isEnded = tradingEndsLabel === "Ended";
  const { claimableDisplay } = useClaimablePayout(market, account?.address);
  const showRedeemable = market.isResolved() && account?.address;
  const redeemableValue = claimableDisplay ?? "0";

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gold/80">
      <span className="flex items-center gap-1">
        <Lock className="h-3 w-3 text-gold" />
        <span className="text-white">{tvl ?? "--"}</span>
        {market.collateralToken ? <TokenIcon token={market.collateralToken as any} size={12} /> : null}
      </span>
      <span className="flex items-center gap-1">
        <Users className="h-3 w-3" />
        <span className="text-white">{holdersCount != null ? holdersCount : "--"} holders</span>
      </span>
      <span className={`flex items-center gap-1 ${showRedeemable ? "text-progress-bar-good" : ""}`}>
        <Wallet className="h-3 w-3" />
        <span className={`${showRedeemable ? "font-semibold" : "text-white"}`}>
          {account?.address ? (showRedeemable ? `+${redeemableValue}` : playerLockedAmount ?? "0") : "--"}
        </span>
        {market.collateralToken ? <TokenIcon token={market.collateralToken as any} size={12} /> : null}
      </span>
      <span className="flex items-center gap-1">
        <Clock3 className="h-3 w-3" />
        <span className="text-white">{isEnded ? "Ended" : `Ends in ${tradingEndsLabel}`}</span>
      </span>
    </div>
  );
};
