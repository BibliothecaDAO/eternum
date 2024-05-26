import { useEffect, useMemo, useState } from "react";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { OrderIcon } from "../../../elements/OrderIcon";
import useUIStore from "../../../../hooks/store/useUIStore";
import useLeaderBoardStore from "../../../../hooks/store/useLeaderBoardStore";
import Button from "../../../elements/Button";
import { currencyIntlFormat, displayAddress } from "../../../utils/utils";

export const PlayersLeaderboard = () => {
  const [loading, _] = useState(false);

  const playerPointsLeaderboard = useLeaderBoardStore((state) => state.playerPointsLeaderboard);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const sortingParams = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank" },
      { label: "Name", sortKey: "name", className: "ml-8" },
      { label: "Order", sortKey: "order", className: "ml-8" },
      { label: "Address", sortKey: "address", className: "ml-10" },
      { label: "Points", sortKey: "points", className: "ml-auto mr-2" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  useEffect(() => {}, [loading]);

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
      </SortPanel>
      {!loading && (
        <div className="flex flex-col p-2 space-y-2 overflow-y-auto">
          {playerPointsLeaderboard.map(({ order, addressName, address, isYours, totalPoints }, i) => {
            return (
              <div
                key={i}
                className={`flex flex-col p-2  clip-angled-sm ${isYours ? "bg-green/20" : ""}  text-xxs text-gold`}
              >
                <div className="flex items-center justify-around text-xxs">
                  <div className="flex-none mr-5">{`#${i + 1}`}</div>
                  <div className="flex-none w-10 text-left">{addressName}</div>
                  <div className="flex-none w-10">
                    <OrderIcon order={order} size="xs" />
                  </div>

                  <div className="flex-none text-left w-20">{displayAddress(address)}</div>

                  <div className="flex-none w-16 text-left flex flex-cols pl-10">
                    <div> {currencyIntlFormat(totalPoints, 0)}</div>
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
