import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";
import { EXPLORATION_COSTS, EternumGlobalConfig } from "@bibliothecadao/eternum";
import { ResourceCost } from "@/ui/elements/ResourceCost";

export const TheMap = () => {
  const chapters = [
    {
      title: "Exploration",
      content: (
        <>
          <p>
            The world map starts unexplored, except for Realms. Exploring new tiles with your armies costs food and
            reveals hidden lands, potentially yielding random resources or uncovering valuable fragment mines.
          </p>
          <ExplorationTable />
        </>
      ),
    },
    {
      title: "Biomes",
      content: "",
    },
  ];

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <>
      <Headline>The Map</Headline>
      {tableOfContents(chapterTitles)}

      {chapters.map((chapter) => (
        <div key={chapter.title}>
          <h2 id={chapter.title}>{chapter.title}</h2>
          {chapter.content}
        </div>
      ))}
    </>
  );
};

const ExplorationTable = () => {
  const explorationCosts = EXPLORATION_COSTS.map((cost) => ({
    ...cost,
  }));

  const exploreCost = EternumGlobalConfig.stamina.exploreCost;
  const travelCost = EternumGlobalConfig.stamina.travelCost;

  return (
    <table className="not-prose w-full p-2 border-gold/10">
      <thead>
        <tr>
          <th className=" p-2"></th>
          <th className="border border-gold/10 p-2">Stamina</th>
          <th className="border border-gold/10 p-2">Resources</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Exploration</td>
          <td className="border border-gold/10 p-2">{exploreCost}</td>
          <td className="border border-gold/10 p-2 gap-1 flex flex-col">
            {explorationCosts.map((cost, index) => (
              <ResourceCost key={index} resourceId={cost.resourceId} amount={cost.amount} size="lg" />
            ))}
          </td>
        </tr>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Travel</td>
          <td className="border border-gold/10 p-2">{travelCost}</td>
          <td className="border border-gold/10 p-2">None</td>
        </tr>
      </tbody>
    </table>
  );
};
