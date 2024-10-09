import { LeaderboardManager } from "@/dojo/modelManager/LeaderboardManager";
import { calculateCompletionPoints } from "@/dojo/modelManager/utils/LeaderboardUtils";
import { useDojo } from "@/hooks/context/DojoContext";
import { useContributions } from "@/hooks/helpers/useContributions";
import { getEntitiesUtils } from "@/hooks/helpers/useEntities";
import {
  ProgressWithPercentage,
  useHyperstructureProgress,
  useHyperstructureUpdates,
} from "@/hooks/helpers/useHyperstructures";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { currencyIntlFormat, getEntityIdFromKeys } from "@/ui/utils/utils";
import {
  ContractAddress,
  EternumGlobalConfig,
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  MAX_NAME_LENGTH,
} from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { useMemo, useState } from "react";
import { ContributionSummary } from "./ContributionSummary";
import { HyperstructureDetails } from "./HyperstructureDetails";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";

enum Loading {
  None,
  Contribute,
  ChangeName,
  SetPrivate,
}

export const HyperstructurePanel = ({ entity }: any) => {
  const {
    account: { account },
    network: { provider },
    setup: {
      systemCalls: { contribute_to_construction, set_private },
      components: { Hyperstructure },
    },
  } = useDojo();

  const [isLoading, setIsLoading] = useState<Loading>(Loading.None);
  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [resetContributions, setResetContributions] = useState(false);

  const structureEntityId = useUIStore((state) => state.structureEntityId);

  const progresses = useHyperstructureProgress(entity.entity_id);

  const { useContributionsByPlayerAddress } = useContributions();

  const myContributions = useContributionsByPlayerAddress(BigInt(account.address), entity.entity_id);

  const updates = useHyperstructureUpdates(entity.entity_id);

  const [newContributions, setNewContributions] = useState<Record<number, number>>({});

  const { getAddressNameFromEntity } = getEntitiesUtils();
  const ownerName = getAddressNameFromEntity(entity.entity_id);

  const hyperstructure = useComponentValue(Hyperstructure, getEntityIdFromKeys([BigInt(entity.entity_id)]));

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
  }, [progresses, myContributions]);

  const initialPoints = useMemo(() => {
    return calculateCompletionPoints(myContributions);
  }, [myContributions, updates]);

  const myShares = useMemo(() => {
    return LeaderboardManager.instance().getAddressShares(ContractAddress(account.address), entity.entity_id);
  }, [myContributions, updates]);

  const setPrivate = async () => {
    setIsLoading(Loading.SetPrivate);
    try {
      await set_private({
        signer: account,
        hyperstructure_entity_id: entity.entity_id,
        to_private: !hyperstructure?.private,
      });
    } finally {
      setIsLoading(Loading.None);
      setNewContributions({});
      setResetContributions(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full">
      <div className="grid grid-cols-5 text-xxs bg-blueish/10 p-1">
        <div className="flex flex-col">
          <div className="">Owner:</div>
          <div>{ownerName}</div>
        </div>
        <div className="col-span-4">
          {editName ? (
            <div className="flex space-x-2">
              <TextInput
                placeholder="Type Name"
                className="h-full flex-grow"
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
            <div className="flex justify-between items-center">
              <h5 className="truncate pr-5">{entity.name}</h5>
              {account.address === entity.owner && (
                <div className="flex flex-col gap-2">
                  <Button size="xs" variant="default" onClick={() => setEditName(!editName)}>
                    edit name
                  </Button>
                  <Button isLoading={isLoading === Loading.SetPrivate} size="xs" variant="default" onClick={setPrivate}>
                    Make {hyperstructure?.private ? "public" : "private"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="w-[100%] grid justify-between m-auto mb-1 gap-1 grid-cols-4">
        <div className="p-1 bg-gold/10 gap-0.5 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center">
            <div className="uppercase text-[10px]">Initial points</div>
            <div className="font-bold text-sm">{currencyIntlFormat(initialPoints)}</div>
          </div>
        </div>
        <div className="p-1 bg-gold/10 gap-0.5 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center">
            <div className="uppercase text-[10px]">Progress</div>
            <div className="font-bold text-sm">{currencyIntlFormat(progresses.percentage)}%</div>
          </div>
        </div>
        <div className="p-1 bg-gold/10 gap-0.5 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center">
            <div className="uppercase text-[10px]">Shares</div>
            <div className="font-bold text-sm">{currencyIntlFormat((myShares || 0) * 100)}%</div>
          </div>
        </div>
        <div className="p-1 bg-gold/10 gap-0.5 hover:bg-crimson/40 hover:animate-pulse">
          <div className="flex flex-col justify-center items-center text-center">
            <div className="uppercase text-[10px]">Points/cycle</div>
            <div className="font-bold text-sm">
              {currencyIntlFormat((myShares || 0) * HYPERSTRUCTURE_POINTS_PER_CYCLE)}
            </div>
          </div>
        </div>
      </div>
      <div className="overflow-y-scroll no-scrollbar h-[40vh] bg-gold/10  p-2">
        <ContributionSummary hyperstructureEntityId={entity.entity_id} className="mb-1" />
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
