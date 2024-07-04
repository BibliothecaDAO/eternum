import { useDojo } from "@/hooks/context/DojoContext";
import { useContributions } from "@/hooks/helpers/useContributions";
import { ProgressWithPercentage, useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useRealm } from "@/hooks/helpers/useRealm";
import useLeaderBoardStore, {
  calculateShares,
  computeHyperstructureLeaderboard,
  PlayerPointsLeaderboardInterface,
} from "@/hooks/store/useLeaderBoardStore";
import useRealmStore from "@/hooks/store/useRealmStore";
import Button from "@/ui/elements/Button";
import { OrderIcon } from "@/ui/elements/OrderIcon";
import { SortButton, SortInterface } from "@/ui/elements/SortButton";
import { SortPanel } from "@/ui/elements/SortPanel";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import {
  EternumGlobalConfig,
  HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  MAX_NAME_LENGTH,
} from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";

enum Loading {
  None,
  Contribute,
  ChangeName,
}

export const HyperstructurePanel = ({ entity }: any) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { contribute_to_construction },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState<Loading>(Loading.None);
  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [resetContributions, setResetContributions] = useState(false);

  const { realmEntityId } = useRealmStore();
  const { useProgress } = useHyperstructures();
  const { getContributionsByPlayerAddress } = useContributions();

  const progresses = useProgress(entity.entity_id);
  const contributions = getContributionsByPlayerAddress(BigInt(account.address), entity.entity_id);

  const [newContributions, setNewContributions] = useState<Record<number, number>>({});

  const contributeToConstruction = async () => {
    const formattedContributions = Object.entries(newContributions).map(([resourceId, amount]) => ({
      resource: Number(resourceId),
      amount: amount * EternumGlobalConfig.resources.resourcePrecision,
    }));

    setIsLoading(Loading.Contribute);
    setResetContributions(true);
    try {
      await contribute_to_construction({
        signer: account,
        contributions: formattedContributions,
        contributor_entity_id: realmEntityId,
        hyperstructure_entity_id: entity.entity_id,
      });
    } finally {
      setIsLoading(Loading.None);
      setNewContributions({});
      setResetContributions(false);
    }
  };

  const resourceElements = useMemo(() => {
    if (progresses.percentage === 100) return;
    return HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED.map(({ resource }) => {
      const progress = progresses.progresses.find(
        (progress: ProgressWithPercentage) => progress.resource_type === resource,
      );
      return (
        <HyperstructureResourceChip
          realmEntityId={realmEntityId}
          setContributions={setNewContributions}
          contributions={newContributions}
          progress={progress!}
          key={resource}
          resourceId={resource}
          resetContributions={resetContributions}
        />
      );
    });
  }, [progresses, contributions]);

  const shares = useMemo(() => {
    return calculateShares(contributions);
  }, [contributions]);

  return (
    <div className="flex flex-col h-[45vh] justify-between">
      <div className="flex flex-col mb-2 bg-blueish/10 p-3 clip-angled-sm">
        <div className=" align-text-bottom uppercase text-xs">Owner: {`${displayAddress(entity.owner)}`}</div>
        <div className="flex flex-row justify-between items-baseline">
          {editName ? (
            <div className="flex space-x-2">
              <TextInput
                placeholder="Type Name"
                className="h-full"
                value={naming}
                onChange={(name) => setNaming(name)}
                maxLength={MAX_NAME_LENGTH}
              />
              <Button
                variant="default"
                isLoading={isLoading === Loading.ChangeName}
                disabled={isLoading !== Loading.None}
                onClick={async () => {
                  setIsLoading(Loading.ChangeName);

                  try {
                    await provider.set_entity_name({ signer: account, entity_id: entity.entity_id, name: naming });
                  } catch (e) {
                    console.error(e);
                  }

                  setIsLoading(Loading.None);
                  setEditName(false);
                }}
              >
                Change Name
              </Button>
            </div>
          ) : (
            <h3 className="truncate pr-5">{entity.name}</h3>
          )}

          {account.address === entity.owner && (
            <>
              <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
                edit name
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="w-[100%] grid justify-between  m-auto mb-2  gap-2 grid-cols-3">
        <div className="flex flex-col  p-3 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-xs">Progress</div>
          <div className="font-bold text-xl">{currencyIntlFormat(progresses.percentage)}%</div>
        </div>
        <div className="flex flex-col  p-3 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-xs">Your shares</div>
          <div className="font-bold text-xl">{currencyIntlFormat(shares * 100)}%</div>
        </div>
        <div className="flex flex-col  p-3 bg-gold/10 clip-angled-sm gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="uppercase text-xs">points/cycle</div>
          <div className="font-bold text-xl ">{currencyIntlFormat(shares * HYPERSTRUCTURE_POINTS_PER_CYCLE)}</div>
        </div>
      </div>
      <div className="overflow-y-scroll h-[40vh] bg-gold/10 clip-angled-sm p-2">
        {progresses.percentage === 100 ? (
          <HyperstructureLeaderboard contributions={contributions} />
        ) : (
          <div className="">{resourceElements}</div>
        )}
      </div>
      <Button
        isLoading={isLoading === Loading.Contribute}
        className="mt-4"
        disabled={Object.keys(newContributions).length === 0 || isLoading !== Loading.None}
        onClick={contributeToConstruction}
      >
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
  const playerPointsLeaderboard = useLeaderBoardStore((state) => state.playerPointsLeaderboard);

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
      {computeHyperstructureLeaderboard(
        playerPointsLeaderboard,
        contributions,
        1,
        account,
        getAddressName,
        getAddressOrder,
      )
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
