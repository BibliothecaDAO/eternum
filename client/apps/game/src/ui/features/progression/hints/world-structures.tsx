import { Headline } from "@/ui/design-system/molecules/headline";
import { ResourceCost } from "@/ui/design-system/molecules/resource-cost";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { configManager, formatTime } from "@bibliothecadao/eternum";
import { findResourceById, resources, ResourcesIds, StructureType } from "@bibliothecadao/types";

const STRUCTURE_IMAGE_PREFIX = "/images/buildings/thumb/";
const STRUCTURE_IMAGE_PATHS = {
  [StructureType.Bank]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.Hyperstructure]: STRUCTURE_IMAGE_PREFIX + "hyperstructure.png",
  [StructureType.Realm]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.FragmentMine]: STRUCTURE_IMAGE_PREFIX + "mine.png",
  [StructureType.Village]: STRUCTURE_IMAGE_PREFIX + "village.png",
};

export const WorldStructures = () => {
  return (
    <div className="space-y-8">
      <Headline>World Structures</Headline>

      <section className="space-y-4">
        <h4>Hyperstructures</h4>
        <div className="space-y-4">
          <HyperstructureCreationTable />
          <HyperstructureCompletionTable />
        </div>
      </section>

      <section className="space-y-4">
        <h4>Mines</h4>
        <div className="space-y-4 text-gray-200">
          <p className="leading-relaxed">
            Naturally occurring structures discovered during exploration, enabling players to harvest precious{" "}
            <span className="font-bold">{findResourceById(Number(ResourcesIds.AncientFragment))?.trait}</span> from the
            world. Be weary of the bandits that inhabit these mines!
          </p>
        </div>
      </section>
    </div>
  );
};

const HyperstructureCreationTable = () => {
  const structureId = StructureType["Hyperstructure"];

  const creationCost = configManager.structureCosts[structureId].map((cost) => ({
    ...cost,
  }));

  return (
    <div className="rounded-lg border border-gold/20 overflow-hidden">
      <table className="not-prose w-full">
        <thead className="bg-gold/5">
          <tr className="border-b border-gold/20">
            <th className="text-left p-4 text-light-pink">Structure</th>
            <th className="text-left p-4 text-light-pink">One Time Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
            <td className="p-4">
              <div className="flex justify-center">
                <img className="h-36 min-w-20" src={STRUCTURE_IMAGE_PATHS[structureId]} alt="Hyperstructure" />
              </div>
            </td>
            <td className="p-4">
              <div className="gap-3 flex flex-col items-center">
                {creationCost.map((cost, index) => (
                  <div key={index} className="flex justify-center">
                    <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                  </div>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="p-4 bg-gold/5 border-t border-gold/20 text-gray-200 leading-relaxed">
        Hyperstructures are key to victory and can be constructed collaboratively. Once built, Hyperstructures generate{" "}
        {configManager.getHyperstructureConfig().pointsPerCycle} base points per tick (multiplied by surrounding
        realms). Once completed, the Hyperstructure owner can distribute shares to others, allowing shareholders to earn
        a portion of the generated points.
        <br />
        <br />
        Defending your Hyperstructure is crucial. If captured by another player, they can redistribute the shares,
        potentially cutting off your point income.
        <br />A new set of shareholers can be set every{" "}
        {formatTime(configManager.getHyperstructureConfig().timeBetweenSharesChange)}.
      </div>
    </div>
  );
};

const HyperstructureCompletionTable = () => {
  const completionCosts = configManager.hyperstructureTotalCosts;

  return (
    <div className="rounded-lg border border-gold/20 overflow-hidden mt-4">
      <table className="not-prose w-full">
        <thead className="bg-gold/5">
          <tr className="border-b border-gold/20">
            <th className="text-left p-4 text-light-pink" colSpan={2}>
              Completion Costs
            </th>
            <th className="text-left p-4 text-light-pink" colSpan={6}></th>
          </tr>
        </thead>
        <tbody>
          {completionCosts.map(({ resource, min_amount, max_amount }) => (
            <tr key={resource} className="border-b border-gold/10 hover:bg-gold/5 transition-colors">
              <td className="p-4" colSpan={8}>
                <div className="flex items-center">
                  <div className="flex">
                    <div className="mr-3">
                      <ResourceIcon size="md" resource={resources.find((r) => r.id === resource)?.trait || ""} />
                    </div>
                  </div>
                  <div className="ml-auto">
                    {min_amount} - {max_amount}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-4 bg-gold/5 border-t border-gold/20 text-gray-200 leading-relaxed">
        Once constructed, the amount of resources needed to complete it is randomly assigned for each resource tier.
        Contributing to the construction of a Hyperstructure can be done from the 'World Structures' menu.
      </div>
    </div>
  );
};
