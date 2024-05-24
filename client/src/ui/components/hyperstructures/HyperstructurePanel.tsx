import { useMemo, useState } from "react";
import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { ProgressWithPourcentage, useHyperstructures } from "@/hooks/helpers/useHyperstructures";

export const HyperstructurePanel = ({ entity }: any) => {
  const {
    account: { account },
    setup: {
      systemCalls: { contribute_to_construction },
    },
  } = useDojo();

  const { realmEntityId } = useRealmStore();

  const { useProgress } = useHyperstructures();
  const progresses = useProgress(realmEntityId);

  const [contributions, setContributions] = useState<Record<number, number>>({});

  const contributeToConstruction = async () => {
    const formattedContributions = Object.entries(contributions).map(([resourceId, amount]) => ({
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
    return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
      const resources = resourceIds.map((resourceId: any) => {
        const progress = progresses.find((progress: ProgressWithPourcentage) => progress.resource_type === resourceId);
        return (
          <HyperstructureResourceChip
            setContributions={setContributions}
            contributions={contributions}
            progress={progress!}
            key={resourceId}
            resourceId={resourceId}
          />
        );
      });

      return (
        <div className="my-4 px-3" key={tier}>
          <div className="grid grid-cols-1 flex-wrap">{resources}</div>
        </div>
      );
    });
  }, [entity]);

  return (
    <div className="flex flex-col h-[50vh] justify-between">
      <div className="flex justify-between">
        <h3>{`Hyperstructure ${entity.entity_id}`}</h3>

        <div>Creator: {`${entity.owner.slice(0, 4)}...${entity.owner.slice(-4)}`}</div>
      </div>
      <div className="overflow-y-scroll h-[40vh] border p-2">
        <div className="">{resourceElements}</div>
      </div>
      <Button disabled={Object.keys(contributions).length === 0} onClick={contributeToConstruction}>
        Contribute
      </Button>
    </div>
  );
};
