import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import { ContractAddress, getOrderName, ID } from "@bibliothecadao/eternum";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { useMemo, useState } from "react";

export const Leaderboard = ({
  hyperstructureEntityId,
  setSelectedTab,
}: {
  hyperstructureEntityId: ID;
  setSelectedTab: (tab: number) => void;
}) => {
  const {
    account: { account },
    setup: {
      components: { HyperstructureUpdate },
    },
  } = useDojo();

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);
  const { getAddressName, getAddressOrder } = useRealm();

  const playerPointsLeaderboard = useMemo(() => {
    return LeaderboardManager.instance().getPlayersByRank(nextBlockTimestamp || 0, hyperstructureEntityId);
  }, [nextBlockTimestamp, hyperstructureEntityId]);

  const updateEntityIds = useEntityQuery([
    HasValue(HyperstructureUpdate, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);

  const update = useMemo(() => {
    return getComponentValue(HyperstructureUpdate, updateEntityIds[0]);
  }, [updateEntityIds]);

  const sortingParams = useMemo(() => {
    return [
      { label: "Name", sortKey: "name", className: "" },
      { label: "Order", sortKey: "order", className: "" },
      { label: "Address", sortKey: "address", className: "" },
      { label: "Points", sortKey: "points", className: "flex justify-end" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return update ? (
    <>
      <SortPanel className="px-3 py-2 grid grid-cols-4">
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
        const playerName = getAddressName(address) || "Player not found";

        const isOwner = address === ContractAddress(account.address);

        const order = getAddressOrder(address) || 0;
        const orderName = getOrderName(order);

        return (
          <div key={index} className={`flex mt-1 ${isOwner ? "bg-green/20" : ""} text-xxs text-gold`}>
            <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
              <div className="flex w-full grid grid-cols-4">
                <div className="text-sm font-bold">{playerName}</div>
                <OrderIcon containerClassName="" order={orderName} size="xs" />
                <div className=" text-sm font-bold">{displayAddress(address.toString(16))}</div>
                <div className="text-right">{currencyIntlFormat(points)}</div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  ) : (
    <div className="w-full h-full flex flex-col justify-center items-center">
      <Button onClick={() => setSelectedTab(1)}>Set first co-owners</Button>
    </div>
  );
};
