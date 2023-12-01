import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs } from "../../elements/tab";
import GuildList from "./GuildList";
import Button from "../../elements/Button";
import { ChannelType } from "../../elements/Channel";
import { useChat } from "../../ChatContext";
import { GroupPermissions } from "@web3mq/client";
import { GroupPermissionValueType } from "@web3mq/client/dist/types";
import GuildChat from "./GuildChat";

type ChatTabsProps = {};

enum SelectedTabEnum {
  ALL_GUILD,
  MY_GUILD,
}

export const getShortAddress = (address: string = "", num: number = 5, endNum = 4) => {
  let strLength = address.length;
  return address.substring(0, num) + "..." + address.substring(strLength - endNum, strLength);
};

export const GuildTabs = (props: ChatTabsProps) => {
  const [selectedTab, setSelectedTab] = useState<SelectedTabEnum>(SelectedTabEnum.ALL_GUILD);
  const [guildList, setGuildList] = useState<ChannelType[]>([]);
  const [activeGuild, setActiveGuild] = useState<ChannelType>();

  const { loginFlow, client, loading, loggedIn } = useChat();
  // this should be moved
  const [loadingList, setLoadingList] = useState(false);
  // todo get ids from torii new contracts
  const guildIds = ["group:54fabcc0ab58776ceab850b53e792eb993935305"];
  const formatGroupPermission = (permission: GroupPermissions): GroupPermissionValueType => {
    if (Object.keys(permission).includes("group:join")) {
      if (permission["group:join"] && permission["group:join"].value) {
        return permission["group:join"].value;
      }
    } else {
      return "creator_invite_friends";
    }
  };

  const handleEvent = (event: { type: any }) => {
    if (event.type === "channel.created") {
      queryGroups();
    }
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

    const getUserNickname = (userInfo) => {
      if (!userInfo) return "";
      return userInfo.nickname || getShortAddress(userInfo.wallet_address) || getShortAddress(userInfo.userid);
    };
    const res = await client?.channel.queryGroups(guildIds, true);
    let list  = res.map((item): ChannelType => {
      return {
        creatorId: item.creator_id,
        groupid: item.groupid,
        avatar: item.avatar_url,
        groupName: item.group_name,
        isJoined: item.is_group_member,
        permissionType: formatGroupPermission(item.permissions),
        memberCount: item.memberCount,
        creator: getUserNickname(item.creatorInfo),
      };
    });
    if (selectedTab === SelectedTabEnum.MY_GUILD) {
      list = list.filter((item) => item.isJoined);
    }
    setGuildList(list);
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

  if (!loggedIn) {
    return (
      <div className="my-2 w-full p-2 flex">
        <Button className="mx-auto" variant="outline" onClick={() => loginFlow()}>
          Connect
        </Button>
      </div>
    );
  }

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
      {activeGuild ? (
        <GuildChat handleBack={() => setActiveGuild(undefined)} guild={activeGuild} />
      ) : (
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
              <Tabs.Panel key={index} className="relative">
                {isLoading ? (
                  <RenderLoading />
                ) : (
                  <GuildList
                    handleChat={(guild: ChannelType) => {
                      console.log(guild, "guild");
                      const list = guildList.map((item) => {
                        if (item.groupid === guild.groupid) {
                          item.isJoined = true;
                        }
                        return item;
                      });
                      setActiveGuild(guild);
                      setGuildList(list);
                    }}
                    guildList={guildList}
                  />
                )}
              </Tabs.Panel>
            ))}
          </Tabs.Panels>
        </Tabs>
      )}
    </div>
  );
};
