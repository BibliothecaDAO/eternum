import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";
import {
  HYPERSTRUCTURE_POINTS_PER_CYCLE,
  StructureType,
  STRUCTURE_COSTS_SCALED,
  HYPERSTRUCTURE_TOTAL_COSTS_SCALED,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { STRUCTURE_IMAGE_PATHS } from "../structures/construction/StructureConstructionMenu";
import { useMemo } from "react";

export const WorldStructures = () => {
  const concepts = useMemo(
    () => [
      {
        name: "Hyperstructures",
        content: (
          <>
            <HyperstructureCreationTable />
            <HyperstructureConstructionTable />
          </>
        ),
      },
      {
        name: "Mines",
        content: (
          <div>
            Naturally occurring structures discovered during exploration, enabling players to harvest precious resources
            from the world.
          </div>
        ),
      },
    ],
    [],
  );

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>World Structures</Headline>
      {tableOfContents(conceptNames)}

      {concepts.map((concept) => (
        <section key={concept.name}>
          <h2 id={concept.name}>{concept.name}</h2>
          {concept.content}
        </section>
      ))}
    </>
  );
};

const HyperstructureCreationTable = () => {
  const structureId = StructureType["Hyperstructure"];

  const creationCost = STRUCTURE_COSTS_SCALED[structureId].map((cost) => ({
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
              <img className="w-24 h-24 " src={STRUCTURE_IMAGE_PATHS[structureId]} />
            </td>
            <td className="gap-1 flex flex-col p-2 items-center">
              {creationCost.map((cost, index) => (
                <div key={index}>
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
              generate {HYPERSTRUCTURE_POINTS_PER_CYCLE} points per Eternum Day. Your share of these points is
              proportional to your contribution to its construction
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
};

const HyperstructureConstructionTable = () => {
  const constructionCost = HYPERSTRUCTURE_TOTAL_COSTS_SCALED.filter(
    (cost) => cost.resource !== ResourcesIds["Earthenshard"],
  ).map((cost) => ({ ...cost }));

  return (
    <table className="not-prose w-full p-2 border-gold/10 mt-5">
      <thead>
        <tr>
          <th colSpan={2}>Contruction Costs</th>
          <th colSpan={6}></th>
        </tr>
      </thead>

      <tbody>
        <tr className="border border-gold/10">
          {[0, 1, 2, 3, 4].map((colIndex) => (
            <td key={colIndex} className="p-2">
              {constructionCost.slice(colIndex * 6, (colIndex + 1) * 6).map((cost, index) => (
                <div key={index}>
                  <ResourceCost className="truncate mb-1" resourceId={cost.resource} amount={cost.amount} size="lg" />
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
