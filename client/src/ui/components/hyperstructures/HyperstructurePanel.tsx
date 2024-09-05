import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { calculateCompletionPoints } from "@/dojo/modelManager/utils/LeaderboardUtils";
import { useDojo } from "@/hooks/context/DojoContext";
import { useContributions } from "@/hooks/helpers/useContributions";
import { ProgressWithPercentage, useHyperstructures, useUpdates } from "@/hooks/helpers/useHyperstructures";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, displayAddress } from "@/ui/utils/utils";
import {
  ContractAddress,
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  MAX_NAME_LENGTH,
} from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";
import { HyperstructureDetails } from "./HyperstructureDetails";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";
import useUIStore from "@/hooks/store/useUIStore";

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

  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const { useProgress } = useHyperstructures();
  const { getContributionsByPlayerAddress } = useContributions();

  const progresses = useProgress(entity.entity_id);
  const contributions = getContributionsByPlayerAddress(BigInt(account.address), entity.entity_id);

  const updates = useUpdates(entity.entity_id);

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
        contributor_entity_id: structureEntityId,
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
    return HYPERSTRUCTURE_TOTAL_COSTS_SCALED.map(({ resource }) => {
      const progress = progresses.progresses.find(
        (progress: ProgressWithPercentage) => progress.resource_type === resource,
      );
      return (
        <HyperstructureResourceChip
          structureEntityId={structureEntityId}
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

  const initialPoints = useMemo(() => {
    return calculateCompletionPoints(contributions);
  }, [contributions, updates]);

  const shares = useMemo(() => {
    return LeaderboardManager.instance().getShares(ContractAddress(account.address), entity.entity_id);
  }, [contributions, updates]);

  return (
    <div className="flex flex-col h-[45vh] justify-between">
      <div className="flex flex-col mb-2 bg-blueish/10 p-3 ">
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

      <div className="w-[100%] grid justify-between  m-auto mb-2  gap-2 grid-cols-4">
        <div className="p-3 bg-gold/10  gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center h-full">
            <div className="uppercase text-xs">Initial points received</div>
            <div className="font-bold text-xl">{currencyIntlFormat(initialPoints)}</div>
          </div>
        </div>
        <div className="p-3 bg-gold/10  gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center h-full">
            <div className="uppercase text-xs">Progress</div>
            <div className="font-bold text-xl">{currencyIntlFormat(progresses.percentage)}%</div>
          </div>
        </div>
        <div className="p-3 bg-gold/10  gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center h-full">
            <div className="uppercase text-xs">Shares</div>
            <div className="font-bold text-xl">{currencyIntlFormat((shares || 0) * 100)}%</div>
          </div>
        </div>
        <div className="p-3 bg-gold/10  gap-1 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center h-full">
            <div className="uppercase text-xs">Points/cycle</div>
            <div className="font-bold text-xl ">
              {currencyIntlFormat((shares || 0) * HYPERSTRUCTURE_POINTS_PER_CYCLE)}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-y-scroll no-scrollbar h-[40vh] bg-gold/10  p-2">
        {progresses.percentage === 100 ? (
          <HyperstructureDetails hyperstructureEntityId={entity.entity_id} />
        ) : (
          <div className="">
            {resourceElements}
            <div className="flex justify-end w-full">
              <Button
                isLoading={isLoading === Loading.Contribute}
                className="mt-4 bg-gold/20"
                disabled={Object.keys(newContributions).length === 0 || isLoading !== Loading.None}
                onClick={contributeToConstruction}
              >
                Contribute
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
