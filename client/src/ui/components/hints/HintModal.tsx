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
      <div className="flex container mx-auto bg-black/90 bg-hex-bg my-10 rounded-xl border border-gold/40">
        <div className="w-1/4 border-r border-gold/10 p-4">
          <h3 className="text-center mb-4">The Lordpedia</h3>
          <div className="space-y-1">
            {sections.map((section) => (
              <div
                className={`p-2 px-4 hover:bg-gold/20 border border-gold/10 shadow-xl duration-300 cursor-pointer rounded ${
                  activeSection.name === section.name ? "bg-gold/20" : ""
                }`}
                key={section.name}
                onClick={() => setActiveSection(section)}
              >
                <h5>{section.name}</h5>
              </div>
            ))}
          </div>
        </div>
        <div className="w-3/4 p-8 prose prose-pink overflow-auto max-h-[calc(80vh)]">{activeSection.content}</div>
      </div>
    </ModalContainer>
  );
};
