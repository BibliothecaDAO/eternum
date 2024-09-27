import useUIStore from "@/hooks/store/useUIStore";
import { guilds } from "@/ui/components/navigation/Config";
import { OSWindow } from "@/ui/components/navigation/OSWindow";
import { GuildsPanel } from "@/ui/components/worldmap/guilds/GuildsPanel";
import { PlayersPanel } from "@/ui/components/worldmap/players/PlayersPanel";
import { Tabs } from "@/ui/elements/tab";
import { useMemo, useState } from "react";

export const Guilds = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const togglePopup = useUIStore((state) => state.togglePopup);
  const isOpen = useUIStore((state) => state.isPopupOpen(guilds));

  const tabs = useMemo(
    () => [
      {
        key: "Guild",
        label: <div>Guilds</div>,
        component: <GuildsPanel />,
      },
      {
        key: "Players",
        label: <div>Players</div>,
        component: <PlayersPanel />,
      },
    ],
    [selectedTab],
  );

  return (
    <OSWindow width="600px" onClick={() => togglePopup(guilds)} show={isOpen} title={guilds} hintSection={"guilds"}>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: number) => setSelectedTab(index)}
        variant="default"
        className="h-full"
      >
        <Tabs.List>
          {tabs.map((tab, index) => (
            <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panels className="overflow-hidden">
          {tabs.map((tab, index) => (
            <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
          ))}
        </Tabs.Panels>
      </Tabs>
    </OSWindow>
  );
};
