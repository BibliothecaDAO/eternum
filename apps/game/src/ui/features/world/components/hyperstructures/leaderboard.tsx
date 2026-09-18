import Button from "@/ui/design-system/atoms/button";
import { useCoarseNowSeconds } from "@/hooks/helpers/use-block-timestamp";
import { SortButton, SortInterface } from "@/ui/design-system/atoms/sort-button";
import { SortPanel } from "@/ui/design-system/molecules/sort-panel";
import { currencyIntlFormat, displayAddress, getEntityIdFromKeys } from "@/ui/utils/utils";
import { configManager, getAddressName, LeaderboardManager, toHexString } from "@bibliothecadao/eternum";
import { useGame, useNativeRow, useNativeRevision, useHyperstructureUpdates } from "@bibliothecadao/react";
import { ContractAddress, ID } from "@bibliothecadao/types";
import { useMemo, useState } from "react";
import { playerAvatarUrl } from "@/hooks/use-player-profile";

const LEADERBOARD_AUTO_REFRESH_INTERVAL_MS = 30_000;

export const Leaderboard = ({
  hyperstructureEntityId,
  setSelectedTab,
}: {
  hyperstructureEntityId: ID;
  setSelectedTab: (tab: number) => void;
}) => {
  const game = useGame();
  const {
    account: { account },
    setup: { store },
  } = game;
  // The coarse clock is the refresh signal: the standings below are recomputed on every render.
  useCoarseNowSeconds(LEADERBOARD_AUTO_REFRESH_INTERVAL_MS / 1000);

  useNativeRevision(["PlayerPoints", "HyperstructureShares", "AddressName"]);
  const playerPointsLeaderboard = LeaderboardManager.instance(store).playersByRank;
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

  const structure = useNativeRow("Structure", {
    game_id: configManager.getActiveGameId(),
    entity_id: hyperstructureEntityId,
  });
  const isOwner = structure?.owner === ContractAddress(account.address);

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
        const playerName = getAddressName(address, store) || "Player not found";
        const playerAddress = toHexString(address);
        const avatarUrl = playerAvatarUrl(playerAddress);

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
