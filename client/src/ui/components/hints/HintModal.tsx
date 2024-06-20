import { Headline } from "@/ui/elements/Headline";
import { ModalContainer } from "../ModalContainer";
import { TheWorld } from "./TheWorld";
import { GettingStarted } from "./GettingStarted";
import { Resources } from "./Resources";

import { Buildings } from "./Buildings";
import { useState } from "react";

type HintModalProps = {
  initialActiveSection?: string;
};
import { Trading } from "./Trading";
import { Combat } from "./Combat";
import { Points } from "./Points";
import { Hyperstructures } from "./Hyperstructures";
import { TheMap } from "./TheMap";
import { Guilds } from "./Guilds";

export const HintModal = ({ initialActiveSection }: HintModalProps) => {
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
      content: <TheMap />,
    },
    {
      name: "Buildings & Bases",
      content: <Buildings />,
    },
    {
      name: "Trading",
      content: <Trading />,
    },
    {
      name: "Combat",
      content: <Combat />,
    },
    {
      name: "Hyperstructures",
      content: <Hyperstructures />,
    },
    {
      name: "Points",
      content: <Points />,
    },
    {
      name: "Guilds",
      content: <Guilds />,
    },
  ];

  const [activeSection, setActiveSection] = useState(
    sections.find((section) => section.name === initialActiveSection) || sections[0],
  );

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
