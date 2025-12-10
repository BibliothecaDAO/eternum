import type { MarketClass } from "@/pm/class";
import { HStack, VStack } from "@pm/ui";

import { useMarketActivity } from "@/pm/hooks/social/useMarketActivity";
import { formatUnits } from "@/pm/utils";
import { useAccount } from "@starknet-react/core";
import { MaybeController } from "../MaybeController";
import { TokenIcon } from "../TokenIcon";

type ActivityEntry = {
  account: string;
  amount: string;
  outcome: string;
  timestamp: number;
};

const AvatarImage = ({ address, className }: { address: string; className?: string }) => {
  const initial = address ? address.slice(2, 4).toUpperCase() : "??";
  return (
    <div
      className={`flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white/10 text-xs text-white ${className ?? ""}`}
    >
      {initial}
    </div>
  );
};

const TimeAgo = ({ date, className }: { date: Date; className?: string }) => {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  const label = minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
  return <span className={className}>{label}</span>;
};

export const MarketActivity = ({ market }: { market: MarketClass }) => {
  const { account } = useAccount();
  const { marketBuys, refresh } = useMarketActivity(market.market_id);

  if (marketBuys.length === 0) {
    return <div className="text-sm text-gold/70">No recent activity yet.</div>;
  }

  const outcomes = market.getMarketOutcomes();

  console.log({ marketToken: market.collateralToken });

  return (
    <VStack className="w-full items-start gap-12">
      <VStack className="items-start gap-6">
        {marketBuys.map((marketBuy, idx) => {
          const bg = BigInt(marketBuy.account_address) === BigInt(account?.address || 0) ? "bg-primary" : "bg-white";
          return (
            <HStack className="gap-3" key={idx}>
              <AvatarImage address={marketBuy.account_address} className={`h-[32px] w-[32px] rounded-full ${bg}`} />

              <VStack className="items-start gap-1">
                <HStack className="text-xs">
                  <MaybeController address={marketBuy.account_address} className="opacity-75" />
                  <TimeAgo date={new Date(Number(marketBuy.timestamp))} className="opacity-75" />
                </HStack>
                <HStack>
                  <div>bought</div>
                  {formatUnits(marketBuy.amount, Number(market.collateralToken.decimals), 2)}
                  <TokenIcon token={market.collateralToken} />
                  <div>of</div>
                  <MaybeController address={outcomes[Number(marketBuy.outcome_index)].name} />
                </HStack>
              </VStack>
            </HStack>
          );
        })}
      </VStack>
    </VStack>
  );
};
