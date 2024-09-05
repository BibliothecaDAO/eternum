import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { useRealm } from "@/hooks/helpers/useRealm";
import useUIStore from "@/hooks/store/useUIStore";
import { ContractAddress, getOrderName } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { PlayerPointsLeaderboardInterface } from "../../../../hooks/store/useLeaderBoardStore";
import { OrderIcon } from "../../../elements/OrderIcon";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { currencyIntlFormat, displayAddress, sortItems } from "../../../utils/utils";

type PlayerPointsLeaderboardKeys = keyof PlayerPointsLeaderboardInterface;

interface SortingParamPlayerPointsLeaderboard {
  label: string;
  sortKey: PlayerPointsLeaderboardKeys;
  className?: string;
}

export const PlayersLeaderboard = () => {
  const {
    account: { account },
  } = useDojo();

  const { getAddressName, getAddressOrder } = useRealm();

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const playerLeaderboard = useMemo(() => {
    return LeaderboardManager.instance().getPlayersByRank(useUIStore.getState().nextBlockTimestamp!);
  }, []);

  const sortingParams: SortingParamPlayerPointsLeaderboard[] = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1" },
      { label: "Name", sortKey: "addressName", className: "col-span-1" },
      { label: "Order", sortKey: "order", className: "col-span-1" },
      { label: "Address", sortKey: "address", className: "col-span-2" },
      { label: "Points", sortKey: "totalPoints", className: "col-span-1" },
    ];
  }, []);

  return (
    <div className="flex flex-col">
      <SortPanel className="px-3 py-2 grid grid-cols-6 gap-4">
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
      <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
        {sortItems(playerLeaderboard, activeSort).map(([address, points], index) => {
          const playerName = getAddressName(address) || "Player not found";

          const isOwner = address === ContractAddress(account.address);

          const order = getAddressOrder(address) || 0;
          const orderName = getOrderName(order);

          return (
            <div
              key={index}
              className={`grid grid-cols-6 gap-4  p-1 ${isOwner ? "bg-green/20" : ""}  text-xxs text-gold`}
            >
              <div className="col-span-1 ">{`#${index + 1}`}</div>
              <div className="col-span-1">{playerName}</div>
              <OrderIcon className="col-span-1" order={orderName} size="xs" />
              <div className="col-span-2">{displayAddress(address.toString(16))}</div>
              <div className="col-span-1"> {currencyIntlFormat(points)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
