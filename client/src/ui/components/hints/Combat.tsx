import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const Combat = () => {
  const concepts = [
    {
      name: "Protecting your Structures",
      content: (
        <>
          <p>
            A formidable defensive Army is vital for protecting your structures. Without it, you risk pillages and
            potential loss of control. A strong defense not only safeguards your assets but also deters potential
            raiders.
          </p>
        </>
      ),
    },
    {
      name: "Exploration",
      content: (
        <p>
          An offensive army is crucial for exploration, engaging foes, and discovering treasures in Eternum. Your army's
          stamina fuels these expeditions.
        </p>
      ),
    },
    {
      name: "Battles",
      content: (
        <p>
          Battles occur when armies meet in the open field. Their duration varies based on troop disparities. Open to
          all, battles can be joined at any time and may involve offensive armies or defensive forces protecting
          structures.
        </p>
      ),
    },
    {
      name: "Battle Chests",
      content: (
        <p>
          Battle resources are locked upon engagement. Victors claim the spoils, dividing them equally among allies.
        </p>
      ),
    },
    {
      name: "Pillaging",
      content: (
        <p>
          Pillaging enemy structures becomes easier as their defensive forces weaken. Successful raids yield a portion
          of the structure's resources.
        </p>
      ),
    },
    {
      name: "Claiming Structures",
      content: (
        <p>
          Upon defeating or bypassing an opponent's defensive forces, you can claim their structure, transferring
          ownership to yourself.
          <br /> Claiming a completed hyperstructure grants you point accumulation, while seizing a mine allows you to
          harvest its earthenshards.
        </p>
      ),
    },
    {
      name: "Leaving a Battle",
      content: (
        <p>Exiting a battle is possible at any moment, but comes at the cost of resources, health, and troop losses.</p>
      ),
    },
  ];

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>Combat</Headline>
      {tableOfContents(conceptNames)}

      <p className="text-xl">
        Armies serve a multifaceted role in Eternum: they safeguard your Realm and structures while also enabling
        exploration of the vast world beyond.
      </p>

      {concepts.map((concept) => (
        <div key={concept.name}>
          <h2 id={concept.name}>{concept.name}</h2>
          {concept.content}
        </div>
      ))}
    </>
  );
};
