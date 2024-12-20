import { addToSubscription } from "@/dojo/queries";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArrivalInfo } from "@/hooks/helpers/use-resource-arrivals";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import Button from "@/ui/elements/Button";
import { Checkbox } from "@/ui/elements/Checkbox";
import { Headline } from "@/ui/elements/Headline";
import { HintModalButton } from "@/ui/elements/HintModalButton";
import { memo, useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { EntityArrival } from "../entities/Entity";
import { HintSection } from "../hints/HintModal";

const DISPLAYED_ARRIVALS = 3;
interface SubscribedIdsStore {
  subscribedIds: Set<string>;
  addSubscribedIds: (ids: string[]) => void;
}

const useSubscribedIdsStore = create<SubscribedIdsStore>((set) => ({
  subscribedIds: new Set<string>(),
  addSubscribedIds: (ids) =>
    set((state) => ({
      subscribedIds: new Set([...state.subscribedIds, ...ids]),
    })),
}));

export const AllResourceArrivals = memo(
  ({ arrivals, className = "" }: { arrivals: ArrivalInfo[]; className?: string }) => {
    const [displayCount, setDisplayCount] = useState(DISPLAYED_ARRIVALS);
    const [showOnlyArrived, setShowOnlyArrived] = useState(true);
    const [showOnlyGuildMembers, setShowOnlyGuildMembers] = useState(false);

    const { nextBlockTimestamp } = useNextBlockTimestamp();
    const { subscribedIds, addSubscribedIds } = useSubscribedIdsStore();

    const { getPlayersInPlayersGuild, getPlayerListInGuild } = useGuilds();

    const {
      account: { account },
      network: { toriiClient, contractComponents },
    } = useDojo();

    const savedGuilds = localStorage.getItem("WHITELIST")?.split(",");

    const whitelistedGuilds = useMemo(() => {
      return [
        ...(savedGuilds
          ?.flatMap((guildId) => getPlayerListInGuild(Number(guildId)))
          .map((player) => BigInt(player.address)) || []),
        ...getPlayersInPlayersGuild(BigInt(account?.address || 0n)).map((player) => BigInt(player.address)),
      ];
    }, [account?.address, savedGuilds]);

    useEffect(() => {
      // Create a single Set from newIds for O(1) lookup

      const newIdsSet = new Set(
        arrivals
          .filter(
            (arrival) =>
              whitelistedGuilds.includes(BigInt(arrival.originOwner)) ||
              BigInt(arrival.originOwner) === BigInt(account.address),
          )
          .map((arrival) => arrival.entityId.toString()),
      );

      // Find ids that aren't already subscribed
      const unsubscribedIds = Array.from(newIdsSet).filter((id) => !subscribedIds.has(id));

      if (unsubscribedIds.length === 0) return;

      // Update zustand store
      addSubscribedIds(unsubscribedIds);

      // Move API call outside of state updates
      addToSubscription(toriiClient, contractComponents as any, unsubscribedIds).catch((error) =>
        console.error("Fetch failed", error),
      );
      console.log("AddToSubscriptionStart - 5");
    }, [arrivals, subscribedIds, addSubscribedIds]);

    const guildPlayers = getPlayersInPlayersGuild(BigInt(account?.address || 0n)).map((player) =>
      BigInt(player.address),
    );

    const filteredArrivals = useMemo(
      () =>
        arrivals.filter((arrival) => {
          const timeCondition = showOnlyArrived ? arrival.arrivesAt < nextBlockTimestamp : true;
          // Add a check for empty guildPlayers array
          const guildCondition = showOnlyGuildMembers
            ? guildPlayers.length === 0
              ? true // If no guild players, show all arrivals
              : guildPlayers.includes(BigInt(arrival.originOwner))
            : true;
          return timeCondition && guildCondition;
        }),
      [arrivals, showOnlyArrived, showOnlyGuildMembers, nextBlockTimestamp, guildPlayers],
    );

    const displayedArrivals = filteredArrivals.slice(0, displayCount);
    const hasMore = displayCount < filteredArrivals.length;

    const loadMore = () => {
      setDisplayCount((prev) => Math.min(prev + DISPLAYED_ARRIVALS, filteredArrivals.length));
    };

    return (
      <div className={`p-2 flex flex-col space-y-1 overflow-y-auto gap-2 ${className}`}>
        <Headline>
          <div className="flex gap-2">
            <div className="self-center">Transfers</div>
            <HintModalButton section={HintSection.Transfers} />
          </div>
        </Headline>
        <div className="px-2 pb-2 flex flex-col gap-2">
          <label className="flex items-center space-x-1 text-xs">
            <Checkbox enabled={showOnlyArrived} onClick={() => setShowOnlyArrived(!showOnlyArrived)} />
            <span>Show only arrived</span>
          </label>
          <label className="flex items-center space-x-1 text-xs">
            <Checkbox enabled={showOnlyGuildMembers} onClick={() => setShowOnlyGuildMembers(!showOnlyGuildMembers)} />
            <span>Show only guild members</span>
          </label>
        </div>
        {displayedArrivals.map((arrival) => (
          <EntityArrival arrival={arrival} key={arrival.entityId} />
        ))}
        {hasMore && (
          <div className="text-center py-4">
            <Button onClick={loadMore} variant="default" size="xs">
              Load More
            </Button>
          </div>
        )}
      </div>
    );
  },
);
