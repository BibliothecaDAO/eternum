import Button from "@/ui/design-system/atoms/button";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import {
  currencyIntlFormat,
  displayAddress,
  getEntityIdFromKeys,
  getRealmCountPerHyperstructure,
} from "@/ui/utils/utils";
import { getAddressName, LeaderboardManager, toHexString } from "@bibliothecadao/eternum";
import { useDojo, useHyperstructureUpdates } from "@bibliothecadao/react";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";
import { getAvatarUrl, normalizeAvatarAddress, useAvatarProfiles } from "@/hooks/use-player-avatar";

export const Leaderboard = ({
  hyperstructureEntityId,
  setSelectedTab,
}: {
  hyperstructureEntityId: ID;
  setSelectedTab: (tab: number) => void;
}) => {
  const dojo = useDojo();
  const {
    account: { account },
    setup: { components },
  } = dojo;

  const playerPointsLeaderboard = useMemo(() => {
    const leaderboardManager = LeaderboardManager.instance(dojo.setup.components, getRealmCountPerHyperstructure());
    const cachedPlayersByRank = leaderboardManager.playersByRank;

    // Calculate real-time points for each player including unregistered shareholder points
    const playersWithRealTimePoints = cachedPlayersByRank.map(([address, cachedPoints]) => {
      // Get only registered points to avoid double-counting
      const registeredPoints = leaderboardManager.getPlayerRegisteredPoints(address);
      const unregisteredShareholderPoints =
        leaderboardManager.getPlayerHyperstructureUnregisteredShareholderPoints(address);
      const totalPoints = registeredPoints + unregisteredShareholderPoints;

      return [address, totalPoints] as [ContractAddress, number];
    });

    // Sort by real-time total points
    return playersWithRealTimePoints.sort(([_A, pointsA], [_B, pointsB]) => pointsB - pointsA);
  }, [dojo.setup.components]);

  const playerAddresses = useMemo(
    () => playerPointsLeaderboard.map(([address]) => toHexString(address)),
    [playerPointsLeaderboard],
  );
  const { data: avatarProfiles } = useAvatarProfiles(playerAddresses);
  const avatarMap = useMemo(() => {
    const map = new Map<string, string>();
    (avatarProfiles ?? []).forEach((profile) => {
      const normalized = normalizeAvatarAddress(profile.playerAddress);
      if (!normalized) return;
      if (profile.avatarUrl) {
        map.set(normalized, profile.avatarUrl);
      }
    });
    return map;
  }, [avatarProfiles]);

  const hyperstructure = useHyperstructureUpdates(hyperstructureEntityId);

  const sortingParams = useMemo(() => {
    return [
      { label: "Name", sortKey: "name", className: "" },
      { label: "Address", sortKey: "address", className: "" },
      { label: "Points", sortKey: "points", className: "flex justify-end" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const isOwner = useMemo(() => {
    const owner = getComponentValue(components.Structure, getEntityIdFromKeys([BigInt(hyperstructureEntityId)]))?.owner;
    if (!owner) return false;
    return ContractAddress(owner) === ContractAddress(account.address);
  }, [hyperstructureEntityId]);

  return hyperstructure ? (
    <>
      <SortPanel className="px-3 py-2 grid grid-cols-3">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>
      {playerPointsLeaderboard.map(([address, points], index) => {
        const playerName = getAddressName(address, components) || "Player not found";
        const playerAddress = toHexString(address);
        const normalized = normalizeAvatarAddress(playerAddress);
        const avatarUrl = normalized ? getAvatarUrl(playerAddress, avatarMap.get(normalized)) : null;

        const isOwner = address === ContractAddress(account.address);

        return (
          <div key={index} className={`flex mt-1 ${isOwner ? "bg-green/20" : ""} text-xxs text-gold`}>
            <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
              <div className="flex w-full grid grid-cols-3">
                <div className="flex items-center gap-2 text-sm font-bold">
                  {avatarUrl && (
                    <img
                      className="h-6 w-6 rounded-full border border-gold/30 object-cover"
                      src={avatarUrl}
                      alt={`${playerName} avatar`}
                    />
                  )}
                  <span className="truncate">{playerName}</span>
                </div>
                <div className=" text-sm font-bold">{displayAddress(address.toString(16))}</div>
                <div className="text-right">{currencyIntlFormat(points)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  ) : isOwner ? (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <Button onClick={() => setSelectedTab(1)}>Set first co-owners</Button>
    </div>
  ) : (
    <div className="w-full h-full flex flex-col justify-center items-center">Owner hasn't set first co-owners yet</div>
  );
};
