import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import Button from "@/ui/elements/Button";
import TextInput from "@/ui/elements/TextInput";
import { ContractAddress, ID, Player } from "@bibliothecadao/eternum";
import { useCallback, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { GuildInviteList } from "./GuildInvitesList";
import { GuildMemberList } from "./GuildMemberList";

interface GuildMembersProps {
  players: Player[];
  selectedGuildEntityId: number;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isOwner?: boolean;
  ownerAddress?: string;
}

export const GuildMembers = ({ players, selectedGuildEntityId, viewPlayerInfo, setIsExpanded }: GuildMembersProps) => {
  const {
    setup: {
      systemCalls: {
        join_guild,
        remove_guild_member,
        disband_guild,
        leave_guild,
        remove_player_from_whitelist,
        set_entity_name,
      },
    },
    account: { account },
  } = useDojo();

  const { useGuildMembers, getGuildFromPlayerAddress, useGuildWhitelist, usePlayerWhitelist, getGuildFromEntityId } =
    useGuilds();

  const { guildMembers } = useGuildMembers(selectedGuildEntityId, players);
  const invitedPlayers = useGuildWhitelist(selectedGuildEntityId, players);
  const userWhitelist = usePlayerWhitelist(ContractAddress(account.address));
  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address));
  const selectedGuild = getGuildFromEntityId(selectedGuildEntityId, ContractAddress(account.address));

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);

  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;
  const userIsInvited = userWhitelist.find((list) => list.guildEntityId === selectedGuildEntityId);

  const removeGuildMember = useCallback((address: ContractAddress) => {
    setIsLoading(true);
    remove_guild_member({
      player_address_to_remove: address,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const leaveGuild = () => {
    setIsLoading(true);
    leave_guild({
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const disbandGuild = () => {
    let calldata = [
      ...guildMembers.filter((member) => !member.isGuildMaster).map((member) => ({ address: member.address })),
      { address: account.address },
    ];

    setIsLoading(true);
    disband_guild({
      calls: calldata,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
      setIsExpanded(false);
    });
  };

  const joinGuild = useCallback((guildEntityId: ID) => {
    setIsLoading(true);
    join_guild({ guild_entity_id: guildEntityId, signer: account }).finally(() => setIsLoading(false));
  }, []);

  const removePlayerFromWhitelist = (address: ContractAddress) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: address,
      guild_entity_id: selectedGuildEntityId,
      signer: account,
    }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-2 overflow-hidden">
      {editName ? (
        <div className="flex flex-row space-x-2">
          <TextInput placeholder="New Name" className="h-full" onChange={(name) => setNaming(name)} />
          <Button
            variant="default"
            isLoading={isLoading}
            onClick={async () => {
              setIsLoading(true);

              try {
                await set_entity_name({ signer: account, entity_id: selectedGuildEntityId, name: naming });
              } catch (e) {
                console.error(e);
              }

              setIsLoading(false);
              setEditName(false);
            }}
          >
            Change Name
          </Button>
          <Pen
            className="ml-2 self-center m-auto w-12 h-12 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
            onClick={() => setEditName(!editName)}
          />
        </div>
      ) : (
        <div className="flex flex-row">
          <h3 className="truncate font-bold ">{selectedGuild?.name}</h3>
          {userIsGuildMaster && (
            <Pen
              className="ml-2 self-center m-auto w-6 h-6 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all"
              onClick={() => setEditName(!editName)}
            />
          )}
        </div>
      )}

      {userIsGuildMaster && (
        <Button className="my-2" variant="primary" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
          {viewGuildInvites ? "Tribe Members" : "Tribe Invites"}
        </Button>
      )}

      <div className="flex-1 min-h-0 ">
        {viewGuildInvites ? (
          <GuildInviteList
            invitedPlayers={invitedPlayers}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
          />
        ) : (
          <GuildMemberList
            guildMembers={guildMembers}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            userIsGuildMaster={userIsGuildMaster}
            removeGuildMember={removeGuildMember}
          />
        )}
      </div>

      <div className="mt-4">
        {userGuild?.entityId === selectedGuildEntityId && (
          <Button
            className="w-full"
            isLoading={isLoading}
            variant="red"
            onClick={() => (userGuild.isOwner ? disbandGuild() : leaveGuild())}
          >
            {userGuild.isOwner ? "Disband Tribe" : "Leave Tribe"}
          </Button>
        )}
        {!userGuild?.entityId && (!selectedGuild?.guild.isPublic ? userIsInvited : true) && (
          <Button
            className="w-full"
            isLoading={isLoading}
            variant="primary"
            onClick={() => joinGuild(selectedGuildEntityId)}
          >
            Join Tribe
          </Button>
        )}
      </div>
    </div>
  );
};
