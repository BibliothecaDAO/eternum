import { useMemo, useState } from "react";
import { HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED, HYPERSTRUCTURE_POINTS_PER_CYCLE } from "@bibliothecadao/eternum";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { ProgressWithPourcentage, useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useContributions } from "@/hooks/helpers/useContributions";
import {
  calculateShares,
  computeHyperstructureLeaderboard,
  PlayerPointsLeaderboardInterface,
} from "@/hooks/store/useLeaderBoardStore";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import { useRealm } from "@/hooks/helpers/useRealm";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";

export const HyperstructurePanel = ({ entity }: any) => {
  const {
    account: { account },
    setup: {
      systemCalls: { contribute_to_construction },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();
  const { useProgress } = useHyperstructures();
  const { getContributionsByPlayerAddress } = useContributions();

  const progresses = useProgress(entity.entity_id);
  const contributions = getContributionsByPlayerAddress(BigInt(account.address), entity.entity_id);

  const [newContributions, setNewContributions] = useState<Record<number, number>>({});

  const contributeToConstruction = async () => {
    const formattedContributions = Object.entries(newContributions).map(([resourceId, amount]) => ({
      resource: Number(resourceId),
      amount,
    }));

    await contribute_to_construction({
      signer: account,
      contributions: formattedContributions,
      contributor_entity_id: realmEntityId,
      hyperstructure_entity_id: entity.entity_id,
    });
  };

  const resourceElements = useMemo(() => {
    if (progresses.pourcentage === 100) return;
    return HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED.map(({ resource }) => {
      const progress = progresses.progresses.find(
        (progress: ProgressWithPourcentage) => progress.resource_type === resource,
      );
      return (
        <HyperstructureResourceChip
          setContributions={setNewContributions}
          contributions={newContributions}
          progress={progress!}
          key={resource}
          resourceId={resource}
        />
      );
    });
  }, [progresses]);

  const shares = useMemo(() => {
    return calculateShares(contributions);
  }, [contributions]);

  return (
    <div className="flex flex-col h-[50vh] justify-between">
      <div className="flex justify-between items-baseline mb-2">
        <h3>{`Hyperstructure ${entity.entity_id}`}</h3>

        <div className=" align-text-bottom">Creator: {`${displayAddress(entity.owner)}`}</div>
      </div>
      <div className="w-[100%] flex flex-row justify-between border m-auto p-2">
        <div className="flex flex-col text-center p-4">
          <div className="text-xl">Progress</div>
          <div className="font-bold text-base">{currencyIntlFormat(progresses.pourcentage)}%</div>
        </div>
        <div className="flex flex-col text-center p-4">
          <div className="text-xl">Your shares</div>
          <div className="font-bold text-base">{currencyIntlFormat(shares * 100)}%</div>
        </div>
        <div className="flex flex-col text-center p-4">
          <div className="text-xl">You receive </div>
          <div className="font-bold text-base">
            {currencyIntlFormat(shares * HYPERSTRUCTURE_POINTS_PER_CYCLE)} points/cycle
          </div>
        </div>
      </div>
      <div className="overflow-y-scroll h-[40vh] border p-2">
        {progresses.pourcentage === 100 ? (
          <HyperstructureLeaderboard contributions={contributions} />
        ) : (
          <div className="">{resourceElements}</div>
        )}
      </div>
      <Button className="mt-4" disabled={Object.keys(newContributions).length === 0} onClick={contributeToConstruction}>
        Contribute
      </Button>
    </div>
  );
};

const HyperstructureLeaderboard = ({ contributions }: any) => {
  const {
    account: { account },
  } = useDojo();

  const { getAddressName, getAddressOrder } = useRealm();

  const sortingParams = useMemo(() => {
    return [
      { label: "Name", sortKey: "name", className: "ml-8" },
      { label: "Order", sortKey: "order", className: "ml-8" },
      { label: "Address", sortKey: "address", className: "ml-10" },
      { label: "Shares", sortKey: "points", className: "ml-auto mr-2" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <>
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
      {computeHyperstructureLeaderboard(contributions, 1, account, getAddressName, getAddressOrder)
        .sort((playerPointsA, playerPointsB) => playerPointsA.totalPoints - playerPointsB.totalPoints)
        .map((playerPoints: PlayerPointsLeaderboardInterface) => {
          return (
            <div className="flex mt-1">
              <div className={`flex relative group items-center text-xs px-2 p-1 w-full`}>
                <div className="flex w-full">
                  <div className=" self-center text-sm font-bold ml-8">{playerPoints.addressName}</div>
                  <OrderIcon className="ml-10" order={playerPoints.order} size="xs" />
                  <div className="ml-10 text-sm font-bold">{displayAddress(playerPoints.address)}</div>
                  <div className="ml-40 pt-2">{playerPoints.totalPoints * 100}%</div>
                </div>
              </div>
            </div>
          );
        })}
    </>
  );
};
