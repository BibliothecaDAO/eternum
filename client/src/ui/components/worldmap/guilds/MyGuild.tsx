import { useState, useMemo } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import Button from "../../../elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { SelectBox } from "@/ui/elements/SelectBox";
import { Tabs } from "../../../elements/tab";

import { useUserGuild, useGuildMembers } from "../../../../hooks/helpers/useGuilds";
import { hasGuild } from "./utils";
import { GuildMembers } from "./GuildMembers";
import { Whitelist } from "./Whitelist";

export const MyGuild = () => {
  const {
    setup: {
      systemCalls: { create_guild, leave_guild },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);

  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [newGuildName, setNewGuildName] = useState("");

  const { userGuildEntityId, isOwner, guildName } = useUserGuild();
  const { guildMembers } = useGuildMembers(userGuildEntityId!);

  const tabs = useMemo(
    () => [
      {
        key: "GuildMembers",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Guild Members</div>
          </div>
        ),
        component: <GuildMembers guildMembers={guildMembers} />,
      },
      {
        key: "Whitelist",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Whitelist</div>
          </div>
        ),
        component: <Whitelist guildEntityId={userGuildEntityId} isOwner={isOwner} />,
      },
    ],
    [selectedTab],
  );

  const createGuild = () => {
    setIsLoading(true);
    setIsCreatingGuild(false);
    create_guild({ is_public: isPublic, guild_name: newGuildName, signer: account }).finally(() => setIsLoading(false));
  };

  const leaveGuild = () => {
    setIsLoading(true);
    leave_guild({ signer: account }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col">
      {hasGuild(userGuildEntityId) ? (
        <>
          <p className="flex justify-center py-2">{guildName}</p>
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

          <div className="flex flex-row justify-end">
            <div className="px-4 my-3">
              <Button isLoading={isLoading} onClick={leaveGuild}>
                Leave Guild
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex my-2 p-4 justify-center">
            <Button isLoading={isLoading} onClick={() => setIsCreatingGuild(!isCreatingGuild)}>
              Create Guild
            </Button>
          </div>

          {isCreatingGuild && (
            <div className="flex justify-between mx-3 mb-3 items-baseline">
              <SelectBox selected={isPublic} onClick={() => setIsPublic(!isPublic)}>
                <p className={`p-1 text-sm ${isPublic ? "text-dark" : "text-gold"}`}>Public</p>
              </SelectBox>
              Guild Name
              <TextInput
                className="border border-gold  !w-1/2 !flex-grow-0 !text-light-pink text-xs"
                value={newGuildName}
                onChange={(newGuildName) => setNewGuildName(newGuildName)}
              />
              <Button onClick={createGuild} disabled={newGuildName == ""}>
                Confirm
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
