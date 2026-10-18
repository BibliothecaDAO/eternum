import { Icon as SemanticIcon } from "@/ui/design-system/icon";
import { Headline } from "@/ui/design-system/molecules/headline";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, formatTime } from "@bibliothecadao/eternum";
import { findResourceById, NEUTRAL_OWNER_NAME, ResourcesIds, StructureType } from "@bibliothecadao/types";

import { ReferenceTable } from "./article";

export const WorldStructures = () => {
  return (
    <div className="space-y-8">
      <Headline>World Structures</Headline>

      <section className="space-y-4">
        <h4>Hyperstructures</h4>
        <div className="space-y-6">
          <HyperstructureCreationTable />
          <HyperstructureCompletionTable />
        </div>
      </section>

      <section className="space-y-4">
        <h4>Mines</h4>
        <p className="leading-relaxed">
          Naturally occurring structures discovered during exploration, enabling players to harvest precious{" "}
          <strong>{findResourceById(Number(ResourcesIds.AncientFragment))?.trait}</strong> from the world. Be wary of{" "}
          {NEUTRAL_OWNER_NAME}, who inhabit these mines!
        </p>
      </section>
    </div>
  );
};

const HyperstructureCreationTable = () => {
  const creationCost = configManager.structureCosts[StructureType["Hyperstructure"]];

  return (
    <div className="space-y-3">
      <ReferenceTable
        label="What a Hyperstructure costs to found"
        cols="1fr 2fr"
        head={["Structure", "One Time Cost"]}
        rows={[
          {
            key: "hyperstructure",
            label: "Hyperstructure",
            cells: [
              <SemanticIcon
                key="art"
                className="h-36 min-w-20"
                name="hyperstructure"
                size={144}
                alt="Hyperstructure"
              />,
              <span key="costs" className="flex flex-col items-start gap-3 py-2">
                {creationCost.map((cost, index) => (
                  <ResourceCost key={index} resourceId={cost.resource} amount={cost.amount} size="lg" />
                ))}
              </span>,
            ],
          },
        ]}
      />
      <p className="leading-relaxed">
        Hyperstructures are key to victory and can be constructed collaboratively. Once built, Hyperstructures generate{" "}
        {configManager.getHyperstructureConfig().pointsPerCycle} base points per tick (multiplied by surrounding
        realms). Once completed, the Hyperstructure owner can distribute shares to others, allowing shareholders to earn
        a portion of the generated points.
      </p>
      <p className="leading-relaxed">
        Defending your Hyperstructure is crucial. If captured by another player, they can redistribute the shares,
        potentially cutting off your point income. A new set of shareholers can be set every{" "}
        {formatTime(configManager.getHyperstructureConfig().timeBetweenSharesChange)}.
      </p>
    </div>
  );
};

const HyperstructureCompletionTable = () => (
  <div className="space-y-3">
    <ReferenceTable
      label="What a Hyperstructure needs to complete"
      cols="1fr auto"
      head={["Completion Costs", ""]}
      rows={configManager.hyperstructureTotalCosts.map(({ resource, min_amount, max_amount }) => ({
        key: resource,
        label: `${min_amount} to ${max_amount}`,
        cells: [<ResourceIcon key="icon" size="md" resource={resource} />, `${min_amount} - ${max_amount}`],
      }))}
    />
    <p className="leading-relaxed">
      Once constructed, the amount of resources needed to complete it is randomly assigned for each resource tier.
      Contributing to the construction of a Hyperstructure can be done from the &apos;World Structures&apos; menu.
    </p>
  </div>
);
