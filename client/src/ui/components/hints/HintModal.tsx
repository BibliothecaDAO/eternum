import { Headline } from "@/ui/elements/Headline";
import { ModalContainer } from "../ModalContainer";
import { useMemo, useState } from "react";
import { GettingStarted } from "./GettingStarted";
import { TheWorld } from "./TheWorld";
import {
  RESOURCE_INPUTS_SCALED,
  RESOURCE_OUTPUTS_SCALED,
  ResourcesIds,
  findResourceById,
  resources,
} from "@bibliothecadao/eternum";
import { currencyFormat } from "@/ui/utils/utils";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { ResourceCost } from "@/ui/elements/ResourceCost";
import { Buildings } from "./Buildings";

export const HintModal = () => {
  const sections = [
    {
      name: "The World",
      content: <TheWorld />,
    },
    {
      name: "Key Concepts",
      content: <GettingStarted />,
    },

    {
      name: "Resources",
      content: <Resources />,
    },
    {
      name: "The Map",
      content: <></>,
    },
    {
      name: "Buildings & Bases",
      content: <Buildings />,
    },
    {
      name: "Trading",
      content: <></>,
    },
    {
      name: "Combat",
      content: <></>,
    },
    {
      name: "Hyperstructures",
      content: <></>,
    },
    {
      name: "Points",
      content: <></>,
    },
  ];
  const [activeSection, setActiveSection] = useState(sections[0]);

  return (
    <ModalContainer>
      <div className="grid grid-cols-12 container mx-auto gap-4 bg-brown my-10 p-4 ornate-borders ">
        <div className="col-span-12 text-center">
          <h3>The Lordpedia</h3>
        </div>

        <div className="col-span-3 border p-3 space-y-1 clip-angled border-gold/10">
          {sections.map((section) => (
            <div
              className={`p-2 px-4 hover:bg-gold/20 clip-angled-sm border border-gold/10 shadow-xl duration-300  ${
                activeSection.name === section.name ? "bg-gold/20 n" : ""
              }`}
              key={section.name}
              onClick={() => setActiveSection(section)}
            >
              <h5>{section.name}</h5>
            </div>
          ))}
        </div>
        <div className="col-span-8 border clip-angled border-gold/10 p-4 prose prose-pink overflow-auto max-h-[calc(80vh)]">
          {activeSection.content}
        </div>
      </div>
    </ModalContainer>
  );
};

export const Resources = () => {
  const resourceTable = useMemo(() => {
    const resources = [];
    for (const resourceId of Object.keys(RESOURCE_INPUTS_SCALED) as unknown as ResourcesIds[]) {
      const calldata = {
        resource: findResourceById(Number(resourceId)),
        amount: RESOURCE_OUTPUTS_SCALED[resourceId],
        resource_type: resourceId,
        cost: RESOURCE_INPUTS_SCALED[resourceId].map((cost) => {
          return {
            ...cost,
          };
        }),
      };

      resources.push(calldata);
    }

    return resources;
  }, []);
  return (
    <div>
      <Headline>Resources</Headline>
      <h4>Resource Production</h4>
      <p className="my-5">
        All resources except for Food have a resource input cost associated. You must have these resources in your
        balance otherwise production stops. Trade with others or banks in order to keep your balances in check.
      </p>

      <table className="not-prose w-full p-2 border-gold/10">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Production p/s</th>
            <th>Cost p/s</th>
          </tr>
        </thead>
        <tbody>
          {resourceTable.map((resource) => (
            <tr className="border border-gold/10" key={resource.resource_type}>
              <td>
                {" "}
                <ResourceIcon size="xl" resource={resource.resource?.trait || ""} />
              </td>
              <td className="text-xl text-center">{currencyFormat(resource.amount, 0)}</td>
              <td className="gap-1 flex flex-col  p-2">
                {resource.cost.map((cost) => (
                  <div key={cost.amount}>
                    <ResourceCost
                      resourceId={cost.resource}
                      amount={currencyFormat(Number(cost.amount), 0)}
                      size="lg"
                    />
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Storage of Food</h4>
      <p className="my-5">
        You can only store a certain capacity of resources per your storehouses. Each storehouse grants you 10k per
        resource. You can build more storehouses to increase your capacity.
      </p>
    </div>
  );
};

export const Banking = () => {
  return (
    <div>
      <Headline>Trading</Headline>
      <p className="my-5">
        Trading is done through Donkeys. You must have Donkeys in your balance in order to trade. You can generate these
        with a market. You can also trade donkeys as they are fungible.
      </p>

      <h5>Banking</h5>
      <p className="my-5">
        Banks exist around the map. You can trade with them or deposit resources. You can even provide liquidity. If you
        have enough money you can create your own bank and set fees.
      </p>
    </div>
  );
};

export const Combat = () => {
  return (
    <div>
      <Headline>Armies</Headline>
      <p className="my-5">
        Armies can be created using your balance of Troops. Remember, everything is fungible so you must generate troops
        in order to build an Army.
      </p>

      <h4>Protecting your Base</h4>
      <p className="my-5">
        To protect your Base you must build a defensive Army. This Army will help protect from raiders.
      </p>
    </div>
  );
};
