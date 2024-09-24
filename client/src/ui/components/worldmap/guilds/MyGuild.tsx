import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import useUIStore from "@/hooks/store/useUIStore";
import { SelectBox } from "@/ui/elements/SelectBox";
import TextInput from "@/ui/elements/TextInput";
import { ContractAddress, MAX_NAME_LENGTH } from "@bibliothecadao/eternum";
import { useCallback, useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useGuilds } from "../../../../hooks/helpers/useGuilds";
import Button from "../../../elements/Button";
import { Tabs } from "../../../elements/tab";
import { GuildMembers } from "./GuildMembers";
import { hasGuild } from "./utils";
import { Whitelist } from "./Whitelist";

export const MyGuild = () => {
  const {
    setup: {
      systemCalls: { create_guild, leave_guild, transfer_guild_ownership },
    },
    network: { provider },
    account: { account },
  } = useDojo();

  const setTooltip = useUIStore((state) => state.setTooltip);

  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [playerAddress, setPlayerAddress] = useState("");
  const [isTransferingOwnership, setIsTransferingOwnership] = useState(false);

  const [isCreatingGuild, setIsCreatingGuild] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [newGuildName, setNewGuildName] = useState("");

  const { getGuildFromPlayerAddress } = useGuilds();

  const guild = getGuildFromPlayerAddress(ContractAddress(account.address));

  const [editMode, setEditMode] = useState(false);
  const [naming, setNaming] = useState("");

  const tabs = useMemo(
    () => [
      {
        key: "GuildMembers",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Guild Members</div>
          </div>
        ),
        component: guild && (
          <GuildMembers
            selectedGuild={{ guildEntityId: guild!.guildEntityId!, name: guild!.guildName! }}
            isOwner={guild!.isOwner}
          />
        ),
      },
      {
        key: "Whitelist",
        label: (
          <div className="flex group relative flex-col items-center">
            <div>Whitelist</div>
          </div>
        ),
        component: guild && <Whitelist guildEntityId={guild!.guildEntityId} isOwner={guild!.isOwner} />,
      },
    ],
    [selectedTab],
  );

  const createGuild = () => {
    setIsLoading(true);
    setIsCreatingGuild(false);
    create_guild({
      is_public: isPublic,
      guild_name: newGuildName,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  const leaveGuild = useCallback(() => {
    setIsLoading(true);
    leave_guild({ signer: account }).finally(() => setIsLoading(false));
  }, []);

  const transferGuildOwnership = useCallback(() => {
    setIsLoading(true);
    transfer_guild_ownership({
      guild_entity_id: guild!.guildEntityId!,
      to_player_address: playerAddress,
      signer: account,
    }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col">
      {guild && hasGuild(guild.guildEntityId) ? (
        <>
          <div className="flex flex-col mx-5">
            <div className="flex flex-row">
              {editMode ? (
                <div className="flex flex-col items-baseline">
                  <TextInput
                    placeholder="Type Name"
                    className=""
                    onChange={(name) => setNaming(name)}
                    maxLength={MAX_NAME_LENGTH}
                  />

                  <Button
                    variant="default"
                    size="xs"
                    isLoading={isLoading}
                    disabled={naming == ""}
                    onClick={async () => {
                      setIsLoading(true);

                      try {
                        await provider.set_entity_name({
                          signer: account,
                          entity_id: guild!.guildEntityId!,
                          name: naming,
                        });
                      } catch (e) {
                        console.error(e);
                      }

                      setIsLoading(false);
                      setEditMode(false);
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              ) : (
                <p className="py-2 text-xl">{guild.guildName}</p>
              )}

              {guild.isOwner && (
                <Pen
                  className={
                    "my-auto ml-2 w-5 fill-gold hover:fill-gold/50 hover:scale-125 hover:animate-pulse duration-300 transition-all"
                  }
                  onClick={() => {
                    setTooltip(null);
                    setEditMode(!editMode);
                  }}
                  onMouseEnter={() => {
                    setTooltip({
                      content: "Edit",
                      position: "top",
                    });
                  }}
                  onMouseLeave={() => {
                    setTooltip(null);
                  }}
                />
              )}
            </div>

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
          </div>

          <div className="flex justify-end">
            <div className="px-4 my-3">
              {guild.isOwner ? (
                <div className="flex justify-end px-3 items-baseline">
                  {isTransferingOwnership && (
                    <>
                      <TextInput
                        placeholder="Player address"
                        className="border border-gold  !w-1/2 !flex-grow-0 !text-light-pink text-xs mx-5"
                        onChange={(playerAddress) => setPlayerAddress(playerAddress)}
                      />
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={transferGuildOwnership}
                        disabled={playerAddress == ""}
                      >
                        Confirm
                      </Button>
                    </>
                  )}

                  {guild.memberCount && guild.memberCount > 1 ? (
                    <Button
                      className="ml-5"
                      isLoading={isLoading}
                      onClick={() => setIsTransferingOwnership(!isTransferingOwnership)}
                      size="xs"
                      variant="primary"
                    >
                      Assign new leader
                    </Button>
                  ) : (
                    <Button variant="primary" isLoading={isLoading} onClick={leaveGuild} size="xs">
                      Disband Guild
                    </Button>
                  )}
                </div>
              ) : (
                <Button variant="primary" isLoading={isLoading} onClick={leaveGuild} size="xs">
                  Leave Guild
                </Button>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex my-2 p-4 justify-center">
            <Button variant="primary" isLoading={isLoading} onClick={() => setIsCreatingGuild(!isCreatingGuild)}>
              Create Guild
            </Button>
          </div>

          {isCreatingGuild && (
            <div className="flex  justify-between items-baseline gap-4 p-4">
              <div className="w-full text-xl">Guild Name</div>

              <TextInput onChange={(newGuildName) => setNewGuildName(newGuildName)} maxLength={MAX_NAME_LENGTH} />
              <div className="flex justify-center gap-2">
                <SelectBox selected={isPublic} onClick={() => setIsPublic(!isPublic)}>
                  Public
                </SelectBox>
                <Button variant="primary" onClick={createGuild} disabled={newGuildName == ""}>
                  Confirm
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
