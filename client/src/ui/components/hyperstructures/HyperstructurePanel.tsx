import { useMemo, useState } from "react";
import { HYPERSTRUCTURE_CONSTRUCTION_COSTS_SCALED, HYPERSTRUCTURE_POINTS_PER_CYCLE } from "@bibliothecadao/eternum";
import { HyperstructureResourceChip } from "./HyperstructureResourceChip";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import useRealmStore from "@/hooks/store/useRealmStore";
import { ProgressWithPourcentage, useHyperstructures } from "@/hooks/helpers/useHyperstructures";
import { useContributions } from "@/hooks/helpers/useContributions";
import { computeContributionPoints } from "@/hooks/store/useLeaderBoardStore";
import { currencyIntlFormat } from "@/ui/utils/utils";

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

  const computeShares = (contributions: any[]): number => {
    let points = 0;
    contributions.forEach((contribution) => {
      points += computeContributionPoints(1, Number(contribution.amount), BigInt(contribution.resource_type));
    });
    return points;
  };

  return (
    <div className="flex flex-col h-[50vh] justify-between">
      <div className="flex justify-between items-baseline">
        <h3>{`Hyperstructure ${entity.entity_id}`}</h3>

        <div className=" align-text-bottom">Creator: {`${entity.owner.slice(0, 4)}...${entity.owner.slice(-4)}`}</div>
      </div>
      <div>
        You own {currencyIntlFormat(computeShares(contributions) * 100)}%. You will receive{" "}
        {currencyIntlFormat(computeShares(contributions) * HYPERSTRUCTURE_POINTS_PER_CYCLE)} points every cycle.
      </div>
      <div className="overflow-y-scroll h-[40vh] border p-2">
        <div className="">{resourceElements}</div>
      </div>
      <Button className="mt-4" disabled={Object.keys(newContributions).length === 0} onClick={contributeToConstruction}>
        Contribute
      </Button>
    </div>
  );
};
