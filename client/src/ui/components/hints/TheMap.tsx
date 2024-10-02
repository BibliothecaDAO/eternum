import { Headline } from "@/ui/elements/Headline";
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
  // const exploreFishBurn = config.globalConfig.exploration.exploreFishBurn;
  // const exploreWheatBurn = config.globalConfig.exploration.exploreWheatBurn;

  // const travelFishBurn = config.globalConfig.exploration.travelFishBurn;
  // const travelWheatBurn = config.globalConfig.exploration.travelWheatBurn;

  return (
    <table className="not-prose w-full border-collapse border border-gold/10">
      <thead>
        <tr>
          <th className="border border-gold/10 p-2"></th>
          <th className="border border-gold/10 p-2">Stamina</th>
          <th className="border border-gold/10 p-2">Resources</th>
        </tr>
      </thead>
      {/* <tbody>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Exploration</td>
          <td className="border border-gold/10 p-2">20</td>
          <td className="border border-gold/10 p-2">
            <div>Fish: {exploreFishBurn} per unit</div>
            <div>Wheat: {exploreWheatBurn} per unit</div>
          </td>
        </tr>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">Travel</td>
          <td className="border border-gold/10 p-2">10</td>
          <td className="border border-gold/10 p-2">
            <div>Fish: {travelFishBurn} per unit</div>
            <div>Wheat: {travelWheatBurn} per unit</div>
          </td>
        </tr>
      </tbody> */}
    </table>
  );
};
