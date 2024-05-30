import { HyperstructurePanel } from "@/ui/components/hyperstructures/HyperstructurePanel";
import { EntityList } from "@/ui/components/list/EntityList";
import { useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { ViewOnMapButton } from "@/ui/components/military/ArmyManagementCard";
import { useDojo } from "@/hooks/context/DojoContext";
import { useContributions } from "@/hooks/helpers/useContributions";
import { calculateShares } from "@/hooks/store/useLeaderBoardStore";
import { currencyIntlFormat } from "@/ui/utils/utils";

export const HyperStructures = ({}: any) => {
  const { hyperstructures } = useHyperstructures();

  const extraContent = (entityId: any) => {
    const hyperstructure = hyperstructures.find((hyperstructure) => hyperstructure.entity_id === BigInt(entityId));
    if (!hyperstructure) return null;
    return (
      <HyperStructureExtraContent
        hyperstructureEntityId={hyperstructure.entity_id!}
        x={hyperstructure.x!}
        y={hyperstructure.y!}
      />
    );
  };
  return (
    <>
      <EntityList
        title="Hyperstructures"
        panel={({ entity }) => <HyperstructurePanel entity={entity} />}
        entityContent={extraContent}
        list={hyperstructures.map((hyperstructure) => ({
          id: hyperstructure.entity_id,
          name: `Hyperstructure ${hyperstructure.entity_id}`,
          ...hyperstructure,
        }))}
      />
    </>
  );
};

const HyperStructureExtraContent = ({
  hyperstructureEntityId,
  x,
  y,
}: {
  hyperstructureEntityId: bigint;
  x: number;
  y: number;
}) => {
  const { getContributionsByPlayerAddress } = useContributions();
  const { useProgress } = useHyperstructures();
  const progress = useProgress(hyperstructureEntityId);
  const playerContributions = getContributionsByPlayerAddress(
    BigInt(useDojo().account.account.address),
    hyperstructureEntityId,
  );

  return (
    <div className="flex space-x-5 items-center text-xs">
      <span className="text-xs font-semibold"></span>
      <ViewOnMapButton
        position={{
          x: x,
          y: y,
        }}
      />
      <div>
        Progress: {`${progress.pourcentage}%`}
        <br />
        Shares: {currencyIntlFormat(calculateShares(playerContributions) * 100, 0)}%
      </div>
    </div>
  );
};
