import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { GuildInviteList } from "@/ui/components/worldmap/guilds/guild-invites-list";
import { GuildMemberList } from "@/ui/components/worldmap/guilds/guild-member-list";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import TwitterShareButton from "@/ui/elements/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { ContractAddress, getGuild, getGuildFromPlayerAddress, ID, PlayerInfo } from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers, useGuildWhitelist, usePlayerWhitelist } from "@bibliothecadao/react";
import { useCallback, useMemo, useState } from "react";
import { env } from "../../../../../env";

interface GuildMembersProps {
  players: PlayerInfo[];
  selectedGuildEntityId: number;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isOwner?: boolean;
  ownerAddress?: string;
}

export const GuildMembers = ({ players, selectedGuildEntityId, viewPlayerInfo, setIsExpanded }: GuildMembersProps) => {
  const {
    setup: {
      components,
      systemCalls: { join_guild, remove_guild_member, disband_guild, remove_player_from_whitelist, set_entity_name },
    },
    account: { account },
  } = useDojo();

  const guildMembers = useGuildMembers(selectedGuildEntityId);
  const invitedPlayers = useGuildWhitelist(selectedGuildEntityId);
  const userWhitelist = usePlayerWhitelist(ContractAddress(account.address));
  const userGuild = useMemo(
    () => getGuildFromPlayerAddress(ContractAddress(account.address), components),
    [account.address, components],
  );

  const selectedGuild = useMemo(
    () => getGuild(selectedGuildEntityId, ContractAddress(account.address), components),
    [selectedGuildEntityId, account.address, components],
  );

  const playerName = players.find((player) => player.address === ContractAddress(account?.address))?.name;

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);

  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;
  const userIsInvited = userWhitelist.find((list) => list.entityId === selectedGuildEntityId);

  const removeGuildMember = useCallback((address: ContractAddress) => {
    setIsLoading(true);
    remove_guild_member({
      player_address_to_remove: address,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

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

  const socialsText =
    userGuild?.entityId === selectedGuildEntityId
      ? formatSocialText(userGuild?.isOwner ? twitterTemplates.createdTribe : twitterTemplates.joinedTribe, {
          tribeName: selectedGuild?.name,
          addressName: playerName,
          url: env.VITE_SOCIAL_LINK,
        })
      : undefined;

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
          {socialsText && <TwitterShareButton text={socialsText} />}
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
            onClick={() => (userGuild.isOwner ? disbandGuild() : removeGuildMember(ContractAddress(account.address)))}
          >
            {userGuild.isOwner ? "Disband Tribe" : "Leave Tribe"}
          </Button>
        )}
        {!userGuild?.entityId && (!selectedGuild?.isPublic ? userIsInvited : true) && (
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
