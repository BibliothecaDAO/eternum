import { useMemo, useState } from "react";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { OrderIcon } from "../../../elements/OrderIcon";
import { ReactComponent as Refresh } from "@/assets/icons/common/refresh.svg";
import useUIStore from "../../../../hooks/store/useUIStore";
import Button from "../../../elements/Button";
import { currencyFormat } from "../../../utils/utils";
import useLeaderBoardStore from "../../../../hooks/store/useLeaderBoardStore";
import { ResourceIcon } from "../../../elements/ResourceIcon";

export const OrdersLeaderboard = () => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const [loading, _] = useState(false);

  const orderLordsLeaderboard = useLeaderBoardStore((state) => state.orderLordsLeaderboard);

  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank" },
      { label: "Order", sortKey: "order", className: "ml-4" },
      { label: "Name", sortKey: "name", className: "ml-6" },
      { label: "Realm Count", sortKey: "count", className: "ml-6" },
      { label: "Total Lords", sortKey: "total_lords", className: "ml-auto mr-4" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

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
            onClick={() => {}}
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
        <div className="flex flex-col p-2 space-y-2  overflow-y-auto">
          {orderLordsLeaderboard.map(({ order, realmCount, totalLords, isYours }, i) => {
            return (
              <div
                key={i}
                className={`flex flex-col p-2 border ${
                  isYours ? "border-order-brilliance" : ""
                } rounded-md text-xxs text-gold`}
              >
                <div className="flex items-center justify-between text-xxs">
                  <div className="flex-none mr-5">{`#${i + 1}`}</div>
                  <div className="flex-none w-10">
                    <OrderIcon order={order} size="xs" />
                  </div>
                  <div className="flex-none w-20">{order}</div>

                  <div className="flex-none w-20">{realmCount}</div>

                  <div className="flex-none w-16 text-left mr-2 flex flex-cols">
                    <div> {currencyFormat(totalLords, 0)}</div>
                    <ResourceIcon resource="Lords" size="xs"></ResourceIcon>
                  </div>
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
