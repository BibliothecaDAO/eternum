import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { SurfaceFrame } from "@/ui/design-system/molecules/popover";
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

  const closeSurface = usePopoverStore((state) => state.closeSurface);

  return (
    <SurfaceFrame title="The Lordpedia" onClose={closeSurface} className="w-[1100px]" bodyClassName="overflow-hidden">
      <div className="flex h-[calc(100vh-9rem)] min-h-0">
        <div className="w-1/4 overflow-auto border-r border-gold/10 p-4">
          <div className="space-y-1">
            {sections.map((section) => (
              <div
                className={`cursor-pointer rounded-md p-2 px-4 duration-300 ${
                  activeSection.name === section.name
                    ? "button-gold text-brown"
                    : "border border-gold/20 bg-black/30 hover:border-gold/40"
                }`}
                key={section.name}
                onClick={() => setActiveSection(section)}
              >
                <h5>{section.name}</h5>
              </div>
            ))}
          </div>
        </div>
        <div className="w-3/4 overflow-auto p-8">{activeSection.content}</div>
      </div>
    </SurfaceFrame>
  );
};
