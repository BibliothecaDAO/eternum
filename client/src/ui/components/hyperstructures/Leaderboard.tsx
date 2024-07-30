import { useDojo } from "@/hooks/context/DojoContext";
import useLeaderBoardStore, { PlayerPointsLeaderboardInterface } from "@/hooks/store/useLeaderBoardStore";
import Button from "@/ui/elements/Button";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import { displayAddress } from "@/ui/utils/utils";
import { useEntityQuery } from "@dojoengine/react";
import { getComponentValue, HasValue } from "@dojoengine/recs";
import { useCallback, useMemo, useState } from "react";
import { BigNumberish, cairo } from "starknet";

export const Leaderboard = ({ hyperstructureEntityId }: { hyperstructureEntityId: bigint }) => {
  const {
    account: { account },
    setup: {
      systemCalls: { set_co_owners },
      components: { HyperstructureUpdate },
    },
  } = useDojo();

  const playerPointsLeaderboard = useLeaderBoardStore((state) => state.playerPointsLeaderboard);

  const updateEntityIds = useEntityQuery([
    HasValue(HyperstructureUpdate, { hyperstructure_entity_id: hyperstructureEntityId }),
  ]);

  const update = useMemo(() => {
    return getComponentValue(HyperstructureUpdate, updateEntityIds[0]);
  }, [updateEntityIds]);

  console.log(update);

  const setCoOwners = useCallback(() => {
    set_co_owners({
      signer: account,
      hyperstructure_entity_id: hyperstructureEntityId,
      co_owners: [cairo.tuple(account.address, 10000) as Record<number, BigNumberish>],
    });
  }, [hyperstructureEntityId, playerPointsLeaderboard]);

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
      {playerPointsLeaderboard
        .sort((playerPointsA, playerPointsB) => playerPointsB.totalPoints - playerPointsA.totalPoints)
        .map((playerPoints: PlayerPointsLeaderboardInterface) => {
          return (
            <div className="flex mt-1">
              <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
                <div className="flex w-full grid grid-cols-4">
                  <div className="text-sm font-bold">{playerPoints.addressName}</div>
                  <OrderIcon containerClassName="" order={playerPoints.order} size="xs" />
                  <div className=" text-sm font-bold">{displayAddress(playerPoints.address)}</div>
                  <div className="text-right">{playerPoints.totalPoints.toFixed(2)}</div>
                </div>
              </div>
            </div>
          );
        })}
    </>
  ) : (
    <div>
      <div>Set the first co-owners</div>
      <Button onClick={setCoOwners}>Set co-owners</Button>
    </div>
  );
};
