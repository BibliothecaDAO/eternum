import { useMemo, useState } from "react";
import { Tabs } from "@/ui/elements/tab";
import { RESOURCE_TIERS } from "@bibliothecadao/eternum";
import { ResourceChip } from "../resources/ResourceChip";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";

export const HyperstructurePanel = ({ entity }: any) => {
  const [newContributions, setNewContributions] = useState<number[]>([]);

  const resourceElements = () => {
    return Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => {
      const resources = resourceIds.map((resourceId: any) => {
        const progress = entity.progress.find(
          (progress: { hyperstructure_entity_id: bigint; resource_type: number; amount: number }) =>
            progress.resource_type === resourceId,
        );
        return <HyperstructureResourceChip amount={progress.amount} key={resourceId} resourceId={resourceId} />;
      });

      return (
        <div className="my-2 px-3" key={tier}>
          <div className="grid grid-cols-1 flex-wrap">{resources}</div>
        </div>
      );
    });
  };

  return (
    <div>
      <div className="flex justify-between items-end">
        <h3>{`Hyperstructure ${entity.entity_id}`}</h3>

        <div>Creator: {`${entity.owner.slice(0, 4)}...${entity.owner.slice(-4)}`}</div>
      </div>
      {resourceElements()}
    </div>
  );
};
