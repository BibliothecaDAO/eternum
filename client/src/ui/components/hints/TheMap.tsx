import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";
import { EXPLORATION_COSTS, EternumGlobalConfig } from "@bibliothecadao/eternum";
import { ResourceCost } from "@/ui/elements/ResourceCost";

export const TheMap = () => {
  const explorationCosts = EXPLORATION_COSTS.map((cost) => ({
    ...cost,
  }));

  const exploreCost = EternumGlobalConfig.stamina.exploreCost;
  const travelCost = EternumGlobalConfig.stamina.travelCost;

  const concepts = [
    {
      name: "Exploration",
      content: (
        <>
          <p>
            The world map starts unexplored, except for Realms. Exploring new tiles with your armies costs food and
            reveals hidden lands, potentially yielding random resources or uncovering valuable fragment mines.
          </p>
          <table className="not-prose w-full p-2 border-gold/10">
            <thead>
              <tr>
                <th className="border border-gold/10 p-2" colSpan={2}>
                  Exploration
                </th>
                <th className="border border-gold/10 p-2" colSpan={2}>
                  Travel
                </th>
              </tr>
              <tr>
                <th className="border border-gold/10 p-2">Stamina</th>
                <th className="border border-gold/10 p-2">Resources</th>
                <th className="border border-gold/10 p-2">Stamina</th>
                <th className="border border-gold/10 p-2">Resources</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gold/10 p-2">
                  <p>{exploreCost}</p>
                </td>
                <td className="border border-gold/10 p-2">
                  {explorationCosts.map((cost, index) => (
                    <ResourceCost key={index} resourceId={cost.resourceId} amount={cost.amount} size="lg" />
                  ))}
                </td>
                <td className="border border-gold/10 p-2">
                  <p>{travelCost}</p>
                </td>
                <td className="border border-gold/10 p-2">
                  <p>None</p>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      ),
    },
    {
      name: "Biomes",
      content: "",
    },
  ];

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>The Map</Headline>
      {tableOfContents(conceptNames)}

      {concepts.map((concept) => (
        <div key={concept.name}>
          <h2 id={concept.name}>{concept.name}</h2>
          {concept.content}
        </div>
      ))}
    </>
  );
};
