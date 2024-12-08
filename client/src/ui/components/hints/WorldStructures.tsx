import { configManager } from "@/dojo/setup";
import { Headline } from "@/ui/elements/Headline";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { formatTime } from "@/ui/utils/utils";
import { findResourceById, ResourcesIds, StructureType } from "@bibliothecadao/eternum";
import { useMemo } from "react";
import { STRUCTURE_IMAGE_PATHS } from "../structures/construction/StructureConstructionMenu";
import { tableOfContents } from "./utils";

export const WorldStructures = () => {
  const chapters = useMemo(
    () => [
      {
        title: "Hyperstructures",
        content: (
          <>
            <HyperstructureCreationTable />
            <HyperstructureCompletionTable />
          </>
        ),
      },
      {
        title: "Mines",
        content: (
          <div>
            Naturally occurring structures discovered during exploration, enabling players to harvest precious{" "}
            <span className="font-bold">{findResourceById(Number(ResourcesIds.AncientFragment))?.trait}</span> from the
            world. Be weary of the bandits that inhabit these mines!
          </div>
        ),
      },
    ],
    [],
  );

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <>
      <Headline>World Structures</Headline>
      {tableOfContents(chapterTitles)}

      {chapters.map((chapter) => (
        <section key={chapter.title}>
          <h2 id={chapter.title}>{chapter.title}</h2>
          {chapter.content}
        </section>
      ))}
    </>
  );
};

const HyperstructureCreationTable = () => {
  const structureId = StructureType["Hyperstructure"];

  const creationCost = configManager.structureCosts[structureId].map((cost) => ({
    ...cost,
  }));

  return (
    <>
      <table className="not-prose w-full p-2 border-gold/10">
        <thead>
          <tr>
            <th>Structure</th>
            <th>One Time Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border border-gold/10">
            <td className="p-2">
              <div className="flex justify-center">
                <img className="h-36 min-w-20" src={STRUCTURE_IMAGE_PATHS[structureId]} />
              </div>
            </td>
            <td className="gap-1 flex flex-col p-2 items-center">
              {creationCost.map((cost, index) => (
                <div key={index} className="flex justify-center">
                  <ResourceCost resourceId={cost.resource} amount={cost.amount} size="lg" />
                </div>
              ))}
            </td>
          </tr>
        </tbody>
        <tfoot className="border border-gold/10">
          <tr>
            <td colSpan={2} className="p-2">
              Hyperstructures are key to victory and can be constructed collaboratively. Once built, Hyperstructures
              generate {configManager.getHyperstructureConfig().pointsPerCycle} points per tick. Once completed, the
              Hyperstructure owner can distribute shares to others, allowing shareholders to earn a portion of the
              generated points.
              <br />
              <br />
              Defending your Hyperstructure is crucial. If captured by another player, they can redistribute the shares,
              potentially cutting off your point income.
              <br />A new set of shareholers can be set every{" "}
              {formatTime(configManager.getHyperstructureConfig().timeBetweenSharesChange)}.
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
};
const HyperstructureCompletionTable = () => {
  const completionCosts = Object.keys(configManager.hyperstructureTotalCosts).map(
    (key) => configManager.hyperstructureTotalCosts[Number(key) as keyof typeof configManager.hyperstructureTotalCosts],
  );

  return (
    <table className="not-prose w-full p-2 border-gold/10 mt-5">
      <thead>
        <tr>
          <th colSpan={2}>Completion Costs</th>
          <th colSpan={6}></th>
        </tr>
      </thead>

      <tbody>
        <tr className="border border-gold/10">
          {[0, 1, 2, 3, 4].map((colIndex) => (
            <td key={colIndex} className="p-2">
              {completionCosts.slice(colIndex * 6, (colIndex + 1) * 6).map((cost, index) => (
                <div className="flex flex-col" key={index}>
                  <ResourceCost
                    className="truncate mb-1"
                    resourceId={cost.resource}
                    amount={cost.min_amount}
                    size="lg"
                  />
                  <ResourceCost
                    className="truncate mb-1"
                    resourceId={cost.resource}
                    amount={cost.max_amount}
                    size="lg"
                  />
                </div>
              ))}
            </td>
          ))}
        </tr>
      </tbody>
      <tfoot className="border border-gold/10">
        <tr>
          <td colSpan={6} className="p-2">
            Contributing to the construction of a Hyperstructure can be done from the 'World Structures' menu. Donkeys
            will be required to transfer the resources to the construction site.
          </td>
        </tr>
      </tfoot>
    </table>
  );
};
