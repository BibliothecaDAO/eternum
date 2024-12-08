import { useContributions } from "@/hooks/helpers/useContributions";
import { useRealm } from "@/hooks/helpers/useRealm";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyIntlFormat, divideByPrecision, formatNumber } from "@/ui/utils/utils";
import { ContractAddress, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useState } from "react";

export const ContributionSummary = ({
  hyperstructureEntityId,
  className,
}: {
  hyperstructureEntityId: ID;
  className?: string;
}) => {
  const { getContributions, getContributionsTotalPercentage } = useContributions({
    componentName: "ContributionSummary",
  });
  const { getAddressName } = useRealm();

  type Resource = {
    amount: number;
    resourceId: number;
  };

  const contributions = getContributions(hyperstructureEntityId);
  const groupedContributions = contributions.reduce<Record<string, Record<number, bigint>>>((acc, contribution) => {
    const { player_address, resource_type, amount } = contribution;
    const playerAddressString = player_address.toString();
    if (!acc[playerAddressString]) {
      acc[playerAddressString] = {};
    }
    if (!acc[playerAddressString][resource_type]) {
      acc[playerAddressString][resource_type] = 0n;
    }
    acc[playerAddressString][resource_type] += amount;
    return acc;
  }, {});

  const resourceContributions: Record<string, Resource[]> = Object.entries(groupedContributions).reduce(
    (acc, [playerAddress, resources]) => {
      acc[playerAddress] = Object.entries(resources).map(([resourceType, amount]) => ({
        amount: Number(amount),
        resourceId: Number(resourceType),
      }));
      return acc;
    },
    {} as Record<string, Resource[]>,
  );

  const [showContributions, setShowContributions] = useState(false);

  // Calculate percentages and sort contributors
  const sortedContributors = Object.entries(groupedContributions)
    .map(([playerAddress, resources]) => ({
      playerAddress,
      resources,
      percentage: getContributionsTotalPercentage(hyperstructureEntityId, resourceContributions[playerAddress]) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <div
        className="flex items-center cursor-pointer hover:text-white"
        onClick={() => setShowContributions(!showContributions)}
      >
        <span className="mr-2">Contributors</span>
        <span className={`transform transition-transform ${showContributions ? "rotate-90" : ""}`}>➤</span>
      </div>
      {showContributions && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {sortedContributors.map(({ playerAddress, resources, percentage }) => (
            <div key={playerAddress} className="bg-gold/10 p-1 rounded">
              <div className="flex flex-row mb-1 justify-between mr-1 items-end">
                <div className="text-sm font-bold">{getAddressName(ContractAddress(playerAddress))}</div>
                <div className="text-xs">{formatNumber(percentage, 2)}%</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(resources).map(([resourceType, amount]) => (
                  <div key={resourceType} className="flex items-center">
                    <ResourceIcon size="xs" resource={ResourcesIds[Number(resourceType)]} />
                    <span className="ml-1 text-xs">{currencyIntlFormat(divideByPrecision(Number(amount)))}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
