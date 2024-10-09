import { ReactComponent as Lightning } from "@/assets/icons/common/lightning.svg";
import { Headline } from "@/ui/elements/Headline";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { multiplyByPrecision } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds, TROOPS_FOOD_CONSUMPTION } from "@bibliothecadao/eternum";
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
  return (
    <table className="not-prose w-full border-collapse border border-gold/10">
      <thead>
        <tr>
          <th className="border border-gold/10 p-2"></th>
          <th className="border border-gold/10 p-2">Stamina</th>
          <th className="border border-gold/10 p-2">Consumes per hex / unit:</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">
            <div className="flex flex-row items-center justify-center">
              <Lightning className="fill-order-power/70 w-8"></Lightning>
              Travel
            </div>
          </td>
          <td className="border border-gold/10 p-2">{EternumGlobalConfig.stamina.travelCost}</td>
          <td>
            <table className="not-prose w-full p-2 border-gold/10 mt-2">
              <thead>
                <tr>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon
                      className="mr-1 text-gold"
                      size="sm"
                      resource={ResourcesIds[ResourcesIds.Crossbowman]}
                    />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Knight]} />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Paladin]} />
                  </th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Crossbowman].travel_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Knight].travel_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Paladin].travel_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Crossbowman].travel_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Knight].travel_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Paladin].travel_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr>
          <td className="border border-gold/10 p-2 font-bold">
            <div className="flex flex-row items-center justify-center">
              <Lightning className="fill-order-power/70 w-8"></Lightning>
              Exploration
            </div>
          </td>
          <td className="border border-gold/10 p-2">{EternumGlobalConfig.stamina.exploreCost}</td>
          <td>
            <table className="not-prose w-full p-2 border-gold/10 mt-2">
              <thead>
                <tr>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon
                      className="mr-1 text-gold"
                      size="sm"
                      resource={ResourcesIds[ResourcesIds.Crossbowman]}
                    />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Knight]} />
                  </th>
                  <th className="border border-gold/10 p-2">
                    <ResourceIcon className="mr-1 text-gold" size="sm" resource={ResourcesIds[ResourcesIds.Paladin]} />
                  </th>
                  <th className="p-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Crossbowman].explore_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Knight].explore_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Paladin].explore_fish_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Fish]} />
                  </td>
                </tr>
                <tr>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Crossbowman].explore_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Knight].explore_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    {multiplyByPrecision(TROOPS_FOOD_CONSUMPTION[ResourcesIds.Paladin].explore_wheat_burn_amount)}
                  </td>
                  <td className="border border-gold/10 p-2 text-center">
                    <ResourceIcon className="mr-1" size="sm" resource={ResourcesIds[ResourcesIds.Wheat]} />
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
};
