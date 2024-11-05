import { Headline } from "@/ui/elements/Headline";
import {} from "@/ui/utils/utils";
import { ExplorationTable } from "./ExplorationTable";
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
