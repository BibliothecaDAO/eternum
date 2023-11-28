import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";
import GuildList from "./GuildList";
import Button from "../../elements/Button";
import { ChannelProps } from "../../elements/Channel";
import { useChat } from "../../ChatContext";

type ChatTabsProps = {};

export const GuildTabs = (props: ChatTabsProps) => {
  const [selectedTab, setSelectedTab] = useState(0);
  const [guildList, setGuildList] = useState<ChannelProps[]>([]);

  const { loginFlow, client, loading, loggedIn } = useChat();
  // this should be moved
  const [loadingList, setLoadingList] = useState(false);

  const guildIds = ['group:3952fed520f965a47d7e189145bec1ec94310be0', 'group:8c1fb4a9a8e690a27c02ee8a0d9a61c1e5ee6ef5']

  const handleEvent = (event: { type: any }) => {
    const format = (channel: any): ChannelProps => {
      console.log(channel, "channel");
      return {
        groupName: "test",
        isJoined: false,
        memberCount: 123,
        creator: "aaa",
        permissionType: "public",
      };
    };

    const list = client?.channel.channelList;

    if (event.type === "channel.updated" || event.type == "channel.getList") {
      console.log("channel.getList", list);
      const res = list?.map((channel: any) => format(channel)) || [];
      console.log(res, "res");
      setGuildList(res);
    }
  };

  const createGuild = () => {
    console.log("createGuild called");
  };

  useEffect(() => {
    if (!client) return;
    client?.channel.queryChannels({ page: 1, size: 20 });
    client?.on("channel.activeChange", handleEvent);
    client?.on("channel.created", handleEvent);
    client?.on("message.delivered", handleEvent);
    client?.on("channel.getList", handleEvent);
    client?.on("message.getList", handleEvent);
    client?.on("channel.updated", handleEvent);
  }, [client]);

  const isLoading = loading || loadingList;

  // const bottomRef = useRef<HTMLDivElement>(null);
  const queryGroups = async () => {
    setLoadingList(true);
    await client?.channel.queryChannels({
      page: 1,
      size: 20,
    });
    setLoadingList(false);
  };

  useEffect(() => {
    if (client) {
      console.log("query groups");
      queryGroups();
    }
  }, [selectedTab, client]);

  const tabs = useMemo(
    () => [
      {
        label: (
          <div className="flex flex-col items-center">
            <div>All Guild</div>
          </div>
        ),
      },
      {
        label: (
          <div className="flex flex-col items-center">
            <div>My Guild</div>
          </div>
        ),
      },
    ],
    [selectedTab],
  );

  const RenderLoading = useCallback(() => {
    return (
      <div className="absolute  h-full bg-black w-full text-white text-center flex justify-center">
        <div className="self-center">
          <img src="/images/eternum-logo_animated.png" className=" invert scale-50" />
        </div>
      </div>
    );
  }, []);

  return (
    <div className="relative flex flex-col h-full overflow-auto">
      {/*{isLoading && <RenderLoading />}*/}
      {!loggedIn && (
        <div className="my-2 w-full p-2 flex">
          <Button className="mx-auto" variant="outline" onClick={() => loginFlow()}>
            Connect
          </Button>
        </div>
      )}
      {guildList.length > 0 && (
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
              <Tabs.Panel key={index} className='relative'>
                { isLoading ? <RenderLoading /> : <GuildList createGuild={createGuild} guildList={guildList} /> }
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      )}
    </div>
  );
};
