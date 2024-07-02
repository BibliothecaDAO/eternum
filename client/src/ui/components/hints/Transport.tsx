import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { BuildingType, EternumGlobalConfig, WEIGHTS } from "@bibliothecadao/eternum";
import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const Transport = () => {
  const concepts = [
    {
      name: "Transport",
      content: (
        <p>
          The trade menu facilitates the transfer of resources across various map locations. Ensure you have a
          sufficient supply of donkeys to enable these transfers.
        </p>
      ),
    },
    {
      name: "Donkeys",
      content: (
        <>
          <p>
            Donkeys are integral to Eternum's economy, serving as the primary means of resource transportation. They
            possess a finite carrying capacity, with each resource type assigned a specific weight.
          </p>
          <p>Donkey carry capacity: {EternumGlobalConfig.carryCapacity.donkey}kg</p>
          <div className="flex mt-4 justify-center w-full gap-8 font-bold border p-2">
            <div className="ml-2">Lords: {`${WEIGHTS[253]} kg/unit`}</div>
            <div>Food: {`${WEIGHTS[254]} kg/unit`}</div>
            <div className="ml-2">Resource: {`${WEIGHTS[1]} kg/unit`}</div>
          </div>
        </>
      ),
    },
    {
      name: "Producing Donkeys",
      content: (
        <div className="flex gap-3">
          <img src={BUILDING_IMAGES_PATH[BuildingType.Market]} alt="" />
          <p>
            Donkeys can be acquired through two primary methods: production at a market facility or acquisition via
            trade on the 'Lords Market'.
          </p>
        </div>
      ),
    },
  ];

  const conceptNames = concepts.map((concept) => concept.name);

  return (
    <>
      <Headline>Transport</Headline>
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
