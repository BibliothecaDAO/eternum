import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const TheMap = () => {
  const concepts = [
    {
      name: "Exploration",
      content: (
        <p>
          The world map starts unexplored, except for Realms. Exploring new tiles with your armies costs food and
          reveals hidden lands, potentially yielding random resources or uncovering valuable fragment mines.
        </p>
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
