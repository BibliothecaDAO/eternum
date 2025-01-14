import { useDojo } from "@/hooks/context/dojo-context";
import { useRealm } from "@/hooks/helpers/use-realm";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { SelectResource } from "@/ui/elements/select-resource";
import { copyPlayerAddressToClipboard, currencyIntlFormat, divideByPrecision, formatNumber } from "@/ui/utils/utils";
import { ContractAddress, ID, LeaderboardManager, ResourcesIds } from "@bibliothecadao/eternum";
import { useMemo, useState } from "react";

export const ContributionSummary = ({
  hyperstructureEntityId,
  className,
}: {
  hyperstructureEntityId: ID;
  className?: string;
}) => {
  const {
    setup: { components },
  } = useDojo();

  const leaderboardManager = useMemo(() => {
    return LeaderboardManager.instance(components);
  }, [components]);

  const { getAddressName } = useRealm();

  const [showContributions, setShowContributions] = useState(false);
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  type Resource = {
    amount: number;
    resourceId: number;
  };

  const contributions = useMemo(() => {
    return leaderboardManager.getContributions(hyperstructureEntityId);
  }, [leaderboardManager, hyperstructureEntityId]);

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
      acc[playerAddress] = Object.entries(resources)
        .filter(([resourceType]) => (selectedResource ? Number(resourceType) === selectedResource : true))
        .map(([resourceType, amount]) => ({
          amount: Number(amount),
          resourceId: Number(resourceType),
        }));
      return acc;
    },
    {} as Record<string, Resource[]>,
  );

  // Calculate percentages and sort contributors
  const sortedContributors = useMemo(
    () =>
      Object.entries(groupedContributions)
        .map(([playerAddress, resources]) => ({
          playerAddress,
          resources,
          percentage:
            leaderboardManager.getContributionsTotalPercentage(
              hyperstructureEntityId,
              resourceContributions[playerAddress],
            ) * 100,
        }))
        .filter(({ resources }) =>
          selectedResource ? resources[selectedResource] > 0n : Object.values(resources).some((amount) => amount > 0n),
        )
        .sort((a, b) => {
          if (selectedResource) {
            const amountA = a.resources[selectedResource] || 0n;
            const amountB = b.resources[selectedResource] || 0n;
            return amountA > amountB ? -1 : amountA < amountB ? 1 : 0;
          }
          return b.percentage - a.percentage;
        }),
    [groupedContributions, selectedResource],
  );

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
        <>
          <SelectResource onSelect={(resourceId) => setSelectedResource(resourceId)} />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {sortedContributors.map(({ playerAddress, resources, percentage }) => {
              const addressName = getAddressName(ContractAddress(playerAddress)) || "Unknown";

              return (
                <div key={playerAddress} className="bg-gold/10 p-1 rounded">
                  <div className="flex flex-row mb-1 justify-between mr-1 items-end">
                    <div
                      onClick={() => copyPlayerAddressToClipboard(ContractAddress(playerAddress), addressName, true)}
                      className="text-sm font-bold cursor-pointer hover:text-gold/50"
                    >
                      {addressName}
                    </div>
                    <div className="text-xs">{formatNumber(percentage, 2)}%</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(resources)
                      .filter(([resourceType]) => (selectedResource ? Number(resourceType) === selectedResource : true))
                      .map(([resourceType, amount]) => (
                        <div key={resourceType} className="flex items-center">
                          <ResourceIcon size="xs" resource={ResourcesIds[Number(resourceType)]} />
                          <span className="ml-1 text-xs">{currencyIntlFormat(divideByPrecision(Number(amount)))}</span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
