import { usePopoverStore } from "@/hooks/store/use-popover-store";
import { HudRow, HudWindow } from "@/ui/design-system/kit/hud-elements";
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
    <HudWindow title="The Lordpedia" size="page" onClose={closeSurface}>
      <div className="grid grid-cols-4 gap-6">
        <nav className="sticky top-0 flex flex-col gap-1 self-start" role="listbox" aria-label="Lordpedia sections">
          {sections.map((section) => (
            <HudRow
              key={section.name}
              title={section.name}
              selected={activeSection.name === section.name}
              onClick={() => setActiveSection(section)}
            />
          ))}
        </nav>
        <article className="col-span-3">{activeSection.content}</article>
      </div>
    </HudWindow>
  );
};
