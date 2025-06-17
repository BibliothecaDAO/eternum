import { ROUTES } from "@/shared/consts/routes";
import { Buildings } from "@/shared/ui/hint-components/buildings";
import { Combat } from "@/shared/ui/hint-components/combat";
import { GettingStarted } from "@/shared/ui/hint-components/getting-started";
import { Guilds } from "@/shared/ui/hint-components/guilds";
import { Points } from "@/shared/ui/hint-components/points";
import { Realm } from "@/shared/ui/hint-components/realm";
import { Resources } from "@/shared/ui/hint-components/resources";
import { TheMap } from "@/shared/ui/hint-components/the-map";
import { TheWorld } from "@/shared/ui/hint-components/the-world";
import { Trading } from "@/shared/ui/hint-components/trading";
import { Transfers } from "@/shared/ui/hint-components/transfers";
import { WorldStructures } from "@/shared/ui/hint-components/world-structures";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { SectionTabs } from "@/shared/ui/section-tabs";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { HintSection, SECTIONS } from "../model/sections";

const SECTION_COMPONENTS = {
  [HintSection.TheWorld]: TheWorld,
  [HintSection.KeyConcepts]: GettingStarted,
  [HintSection.Realms]: Realm,
  [HintSection.Resources]: Resources,
  [HintSection.Transfers]: Transfers,
  [HintSection.TheMap]: TheMap,
  [HintSection.Buildings]: Buildings,
  [HintSection.Trading]: Trading,
  [HintSection.Combat]: Combat,
  [HintSection.WorldStructures]: WorldStructures,
  [HintSection.Points]: Points,
  [HintSection.Tribes]: Guilds,
};

export function LordpediaPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<HintSection>(HintSection.TheWorld);

  const handleBack = () => {
    navigate({ to: ROUTES.HOME });
  };

  const handleSectionChange = (sectionId: string) => {
    setActiveSection(sectionId as HintSection);
  };

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  const tabSections = SECTIONS.map((section) => ({
    id: section.id,
    name: section.name,
  }));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between p-2"></div>

        {/* Section Tabs */}
        <SectionTabs sections={tabSections} activeSection={activeSection} onSectionChange={handleSectionChange} />
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 pb-24">
          <ActiveComponent />
        </div>
      </ScrollArea>
    </div>
  );
}
