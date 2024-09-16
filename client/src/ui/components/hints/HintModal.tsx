import { Headline } from "@/ui/elements/Headline";
import { useState } from "react";
import { ModalContainer } from "../ModalContainer";
import { Buildings } from "./Buildings";
import { Combat } from "./Combat";
import { GettingStarted } from "./GettingStarted";
import { Guilds } from "./Guilds";
import { Points } from "./Points";
import { Resources } from "./Resources";
import { TheMap } from "./TheMap";
import { TheWorld } from "./TheWorld";
import { Trading } from "./Trading";
import { Transfers } from "./Transfers";
import { WorldStructures } from "./WorldStructures";

export enum HintSection {
  TheWorld = "The World",
  KeyConcepts = "Key Concepts",
  Resources = "Resources",
  Transfers = "Transfers",
  TheMap = "The Map",
  Buildings = "Buildings & Bases",
  Trading = "Trading",
  Combat = "Combat",
  WorldStructures = "World Structures",
  Points = "Points",
  Guilds = "Guilds",
}

type HintModalProps = {
  initialActiveSection?: string;
};

export const HintModal = ({ initialActiveSection }: HintModalProps) => {
  const sections = [
    {
      name: HintSection.TheWorld,
      content: <TheWorld />,
    },
    {
      name: HintSection.KeyConcepts,
      content: <GettingStarted />,
    },

    {
      name: HintSection.Resources,
      content: <Resources />,
    },
    {
      name: HintSection.Transfers,
      content: <Transfers />,
    },
    {
      name: HintSection.TheMap,
      content: <TheMap />,
    },
    {
      name: HintSection.Buildings,
      content: <Buildings />,
    },
    {
      name: HintSection.Trading,
      content: <Trading />,
    },
    {
      name: HintSection.Combat,
      content: <Combat />,
    },
    {
      name: HintSection.WorldStructures,
      content: <WorldStructures />,
    },
    {
      name: HintSection.Points,
      content: <Points />,
    },
    {
      name: HintSection.Guilds,
      content: <Guilds />,
    },
  ];

  const [activeSection, setActiveSection] = useState(
    sections.find((section) => section.name === initialActiveSection) || sections[0],
  );

  return (
    <ModalContainer>
      <div className="grid grid-cols-12 container mx-auto gap-4 bg-black/90 bg-hex-bg my-10 p-4  ">
        <div className="col-span-12 text-center">
          <h3>The Lordpedia</h3>
        </div>

        <div className="grid grid-cols-2 border p-3 space-y-1  border-gold/10">
          {sections.map((section) => (
            <div
              className={`p-2 px-4 hover:bg-gold/20  border border-gold/10 shadow-xl duration-300  ${
                activeSection.name === section.name ? "bg-gold/20 n" : ""
              }`}
              key={section.name}
              onClick={() => setActiveSection(section)}
            >
              <h5>{section.name}</h5>
            </div>
          ))}
        </div>
        <div className="col-span-8 border  border-gold/10 p-4 prose prose-pink overflow-auto max-h-[calc(80vh)]">
          {activeSection.content}
        </div>
      </div>
    </ModalContainer>
  );
};

const Banking = () => {
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
