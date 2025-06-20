import { ModalContainer } from "@/ui/shared";
import { useState } from "react";
import { Buildings } from "./buildings";
import { Combat } from "./combat";
import { GettingStarted } from "./getting-started";
import { Guilds } from "./guilds";
import { Points } from "./points";
import { Realm } from "./realm";
import { Resources } from "./resources";
import { TheMap } from "./the-map";
import { TheWorld } from "./the-world";
import { Trading } from "./trading";
import { Transfers } from "./transfers";
import { WorldStructures } from "./world-structures";

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
  Tribes = "Tribes",
  Realm = "Realms",
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
      name: HintSection.Realm,
      content: <Realm />,
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
      name: HintSection.Tribes,
      content: <Guilds />,
    },
  ];

  const [activeSection, setActiveSection] = useState(
    sections.find((section) => section.name === initialActiveSection) || sections[0],
  );

  return (
    <ModalContainer>
      <div className="flex container mx-auto bg-brown/90 my-10 rounded-xl border border-gold/40 panel-wood">
        <div className="w-1/4 border-r border-gold/10 p-4 panel-wood-right">
          <h3 className="text-center mb-4">The Lordpedia</h3>
          <div className="space-y-1">
            {sections.map((section) => (
              <div
                className={`p-2 px-4 duration-300 cursor-pointer  ${
                  activeSection.name === section.name ? " button-gold text-brown" : "panel-wood"
                }`}
                key={section.name}
                onClick={() => setActiveSection(section)}
              >
                <h5>{section.name}</h5>
              </div>
            ))}
          </div>
        </div>
        <div className="p-8 w-3/4  overflow-auto max-h-[calc(80vh)]">{activeSection.content}</div>
      </div>
    </ModalContainer>
  );
};
