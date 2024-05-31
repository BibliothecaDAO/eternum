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
        label: (
          <div className="flex group relative flex-col items-center">
            <div>All Guilds</div>
          </div>
        ),
        component: <Guilds />,
      },
      {
        key: "MyGuild",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>My Guild</div>
          </div>
        ),
        component: <MyGuild />,
      },
      {
        key: "Invites",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Invites</div>
          </div>
        ),
        component: <GuildInvites />,
      },
    ],
    [selectedTab],
  );

  return (
    <>
      <Tabs
        selectedIndex={selectedTab}
        onChange={(index: any) => setSelectedTab(index)}
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
    </>
  );
};
