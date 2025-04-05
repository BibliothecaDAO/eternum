import Button from "@/ui/elements/button";
import { SortButton, SortInterface } from "@/ui/elements/sort-button";
import { SortPanel } from "@/ui/elements/sort-panel";
import { currencyIntlFormat, displayAddress, getEntityIdFromKeys } from "@/ui/utils/utils";
import { ContractAddress, getAddressName, ID, LeaderboardManager } from "@bibliothecadao/eternum";
import { useDojo, useHyperstructureUpdates } from "@bibliothecadao/react";
import { getComponentValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

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
    return LeaderboardManager.instance(dojo.setup.components).getPlayersByRank();
  }, [hyperstructureEntityId]);

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

        const isOwner = address === ContractAddress(account.address);

        return (
          <div key={index} className={`flex mt-1 ${isOwner ? "bg-green/20" : ""} text-xxs text-gold`}>
            <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
              <div className="flex w-full grid grid-cols-3">
                <div className="text-sm font-bold">{playerName}</div>
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
