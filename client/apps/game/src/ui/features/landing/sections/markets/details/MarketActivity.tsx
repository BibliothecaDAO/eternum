import { useEffect, useState } from "react";

import type { MarketClass } from "@/pm/class";
import { HStack, VStack } from "@pm/ui";

import { MaybeController } from "../MaybeController";

type ActivityEntry = {
  account: string;
  amount: string;
  outcome: string;
  timestamp: number;
};

const AvatarImage = ({ address, className }: { address: string; className?: string }) => {
  const initial = address ? address.slice(2, 4).toUpperCase() : "??";
  return (
    <div className={`flex h-[32px] w-[32px] items-center justify-center rounded-full bg-white/10 text-xs text-white ${className ?? ""}`}>
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
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    // In a full build we'd load on-chain buys; for now show an empty state.
    setActivity([]);
  }, [market.market_id]);

  if (activity.length === 0) {
    return <div className="text-sm text-gold/70">No recent activity yet.</div>;
  }

  const outcomes = market.getMarketOutcomes();

  return (
    <VStack className="w-full items-start gap-6">
      {activity.map((entry, idx) => {
        const outcomeLabel = outcomes[Number(entry.outcome)]?.name ?? entry.outcome;

        return (
          <HStack className="gap-3" key={`${entry.account}-${idx}`}>
            <AvatarImage address={entry.account} />
            <VStack className="items-start gap-1 text-sm text-white/80">
              <HStack className="text-xs text-white/60">
                <MaybeController address={entry.account} />
                <TimeAgo date={new Date(entry.timestamp)} className="ml-2" />
              </HStack>
              <HStack className="gap-1">
                <span>bought</span>
                <span className="text-gold">{entry.amount}</span>
                <span>of</span>
                <MaybeController address={outcomeLabel} />
              </HStack>
            </VStack>
          </HStack>
        );
      })}
    </VStack>
  );
};
