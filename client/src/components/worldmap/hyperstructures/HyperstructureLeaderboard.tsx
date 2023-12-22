import { useEffect, useMemo, useState } from "react";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { OrderIcon } from "../../../elements/OrderIcon";
import { ReactComponent as Refresh } from "../../../assets/icons/common/refresh.svg";
import useUIStore from "../../../hooks/store/useUIStore";
import useLeaderBoardStore, { LeaderboardInterface } from "../../../hooks/store/useLeaderBoardStore";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import Button from "../../../elements/Button";
import { displayAddress } from "../../../utils/utils";
import { useDojo } from "../../../DojoContext";
import { useRealm } from "../../../hooks/helpers/useRealm";

export const HyperstructureLeaderboard = () => {
  const [sortedRealms, setSortedRealms] = useState<LeaderboardInterface[]>([]);

  const {
    setup: { components },
  } = useDojo();

  const { getAddressName } = useRealm();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const { getHyperstructureIds } = useHyperstructure();

  const { loading, leaderboard, syncData } = useLeaderBoardStore();

  useEffect(() => {
    if (Object.keys(leaderboard).length === 0) {
      console.log("sync data");
      let ids = getHyperstructureIds();
      syncData(ids, components);
    }
  }, []);

  const onRefresh = () => {
    let ids = getHyperstructureIds();
    syncData(ids, components);
  };

  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank" },
      { label: "Order", sortKey: "order", className: "ml-4" },
      { label: "Address", sortKey: "address", className: "ml-4" },
      { label: "Lord Name", sortKey: "name", className: "ml-6" },
      { label: "Total Points", sortKey: "total_points", className: "ml-auto mr-4" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  useEffect(() => {
    setSortedRealms(Object.values(leaderboard).sort((a, b) => b.total_points - a.total_points));
  }, [loading]);

  return (
    <div className="flex flex-col">
      <SortPanel className="px-3 py-2">
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
        {!loading && (
          <Refresh
            onClick={onRefresh}
            onMouseLeave={() => setTooltip(null)}
            onMouseEnter={() =>
              setTooltip({
                position: "bottom",
                content: (
                  <>
                    <p className="whitespace-nowrap">Click here to refresh the leaderboard</p>
                  </>
                ),
              })
            }
            className="text-gold cursor-pointer"
          ></Refresh>
        )}
      </SortPanel>
      {!loading && (
        <div className="flex flex-col p-2 space-y-2 max-h-40 overflow-y-auto">
          {sortedRealms.map(({ order, address, total_points }, i) => {
            return (
              <div key={i} className={`flex flex-col p-2 border rounded-md text-xxs text-gold`}>
                <div className="flex items-center justify-between text-xxs">
                  <div className="flex-none mr-5">{`#${i + 1}`}</div>
                  <div className="flex-none w-10">
                    <OrderIcon order={order} size="xs" />
                  </div>

                  <div className="flex-none text-left w-20">{displayAddress(address)}</div>

                  <div className="flex-none w-20">{getAddressName(address)}</div>

                  <div className="flex-none w-16 text-left mr-2">{Math.floor(total_points)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {loading && (
        <div className="flex justify-center items-center min-h-[50px]">
          (
          <Button isLoading={true} onClick={() => {}} variant="danger" className="p-2 !h-4 text-xxs !rounded-md">
            {" "}
            {}{" "}
          </Button>
          )
        </div>
      )}
    </div>
  );
};
