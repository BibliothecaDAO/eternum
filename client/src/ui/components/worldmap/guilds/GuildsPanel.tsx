import { useMemo, useState } from "react";
import { Tabs } from "../../../elements/tab";
import { Guilds } from "./Guilds";
import { MyGuild } from "./MyGuild";
import { GuildInvites } from "./GuildInvites";

export const GuildsPanel = () => {
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = useMemo(
    () => [
      {
        key: "Guilds",
        label: <div>All Guilds</div>,
        component: <Guilds />,
      },
      {
        key: "MyGuild",
        label: <div>My Guild</div>,
        component: <MyGuild />,
      },
      {
        key: "Invites",
        label: <div>Invites</div>,
        component: <GuildInvites />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: number) => setSelectedTab(index)}
        variant="default"
        className="h-full border-t"
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
    </>
  );
};
