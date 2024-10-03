import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { tableOfContents } from "./utils";

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
  const exploreFishBurn = multiplyByPrecision(EternumGlobalConfig.exploration.exploreFishBurn);
  const exploreWheatBurn = multiplyByPrecision(EternumGlobalConfig.exploration.exploreWheatBurn);

  const travelFishBurn = multiplyByPrecision(EternumGlobalConfig.exploration.travelFishBurn);
  const travelWheatBurn = multiplyByPrecision(EternumGlobalConfig.exploration.travelWheatBurn);

  return (
    <table className="not-prose w-full border-collapse border border-gold/10">
      <thead>
        <tr>
          <th className="border border-gold/10 p-2"></th>
          <th className="border border-gold/10 p-2">Stamina</th>
          <th className="border border-gold/10 p-2">Resources</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Exploration</td>
          <td className="border border-gold/10 p-2">
            <div className="flex flex-row items-center justify-around">
              <Lightning className="fill-order-power/70 w-8"></Lightning>
              <p>20</p>
            </div>
          </td>
          <td className="border border-gold/10 p-2">
            <div className="flex flex-row items-center justify-around">
              <ResourceIcon size="xl" resource={ResourcesIds[ResourcesIds.Wheat]} />
              <p>{exploreWheatBurn} / unit</p>
            </div>
            <div className="flex flex-row items-center justify-around">
              <ResourceIcon size="xl" resource={ResourcesIds[ResourcesIds.Fish]} />
              <p>{exploreFishBurn} / unit</p>
            </div>
          </td>
        </tr>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Travel</td>
          <td className="border border-gold/10 p-2">
            <div className="flex flex-row items-center justify-around">
              <Lightning className="fill-order-power/70 w-8"></Lightning>
              <p>10</p>
            </div>
          </td>
          <td className="border border-gold/10 p-2">
            <div className="flex flex-row items-center justify-around">
              <ResourceIcon size="xl" resource={ResourcesIds[ResourcesIds.Wheat]} />
              <p>{travelWheatBurn} / unit</p>
            </div>
            <div className="flex flex-row items-center justify-around">
              <ResourceIcon size="xl" resource={ResourcesIds[ResourcesIds.Fish]} />
              <p>{travelFishBurn} / unit</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
