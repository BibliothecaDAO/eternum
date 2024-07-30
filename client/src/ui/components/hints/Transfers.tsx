import { BUILDING_IMAGES_PATH } from "@/ui/config";
import { BuildingType, EternumGlobalConfig, ResourcesIds, WEIGHTS } from "@bibliothecadao/eternum";
import { Headline } from "@/ui/elements/Headline";
import { tableOfContents } from "./utils";

export const Transfers = () => {
  const chapters = [
    {
      title: "Transport",
      content:
        "The trade menu facilitates the transfer of resources across various map locations. Ensure you have a sufficient supply of donkeys to enable these transfers.",
    },
    {
      title: "Donkeys",
      content: (
        <>
          <p>
            Donkeys are integral to Eternum's economy, serving as the primary means of resource transportation. They
            possess a finite carrying capacity, with each resource type assigned a specific weight.
          </p>
          <p>
            Donkey carry capacity: <strong>{EternumGlobalConfig.carryCapacity.donkey}kg</strong>
          </p>
          <div className="flex mt-4 justify-center w-full gap-8 font-bold border p-2">
            <div className="ml-2">Lords: {`${WEIGHTS[ResourcesIds.Lords]} kg/unit`}</div>
            <div>Food: {`${WEIGHTS[ResourcesIds.Wheat]} kg/unit`}</div>
            <div className="ml-2">Resource: {`${WEIGHTS[ResourcesIds.Wood]} kg/unit`}</div>
          </div>
        </>
      ),
    },
    {
      title: "Producing Donkeys",
      content: (
        <div className="flex gap-3 items-center">
          <img src={BUILDING_IMAGES_PATH[BuildingType.Market]} alt="" />
          <div className="flex flex-col">
            <p className="font-bold">Donkeys can be acquired through:</p>
            <p>
              - Production at a <span className="font-bold">market</span> facility
            </p>
            <p>
              - Acquisition via <span className="font-bold">trade</span> on the 'Lords' Market'.
            </p>
          </div>
        </div>
      ),
    },
  ];

  const chapterTitles = chapters.map((chapter) => chapter.title);

  return (
    <>
      <Headline>Transfers</Headline>
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
