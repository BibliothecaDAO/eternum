import { ReactComponent as Pen } from "@/assets/icons/common/pen.svg";
import { GuildInviteList } from "@/ui/components/worldmap/guilds/guild-invites-list";
import { GuildMemberList } from "@/ui/components/worldmap/guilds/guild-member-list";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import TwitterShareButton from "@/ui/elements/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { ContractAddress, getGuild, getGuildFromPlayerAddress, PlayerInfo } from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers, useGuildWhitelist, usePlayerWhitelist } from "@bibliothecadao/react";
import { useCallback, useMemo, useState } from "react";
import { env } from "../../../../../env";

interface GuildMembersProps {
  players: PlayerInfo[];
  selectedGuildEntityId: ContractAddress;
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
    () => getGuild(Number(selectedGuildEntityId), ContractAddress(account.address), components),
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

  const joinGuild = useCallback((guildEntityId: ContractAddress) => {
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
    <div className="flex flex-col min-h-72 h-full w-full p-4 overflow-hidden">
      {editName ? (
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
          <TextInput placeholder="New Name" className="w-full" onChange={(name) => setNaming(name)} />
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
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
              className="min-w-24"
            >
              Change Name
            </Button>
            <Pen
              className="self-center w-6 h-6 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all p-1 border border-gold/30 rounded-md"
              onClick={() => setEditName(!editName)}
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center mb-4">
          <h3 className="truncate font-semibold text-gold/90 text-lg">{selectedGuild?.name}</h3>
          {userIsGuildMaster && (
            <Pen
              className="ml-2 w-6 h-6 fill-gold hover:scale-125 hover:animate-pulse duration-300 transition-all cursor-pointer"
              onClick={() => setEditName(!editName)}
            />
          )}
          {socialsText && (
            <div className="ml-2">
              <TwitterShareButton text={socialsText} />
            </div>
          )}
        </div>
      )}

      {userIsGuildMaster && (
        <Button className="w-full mb-4" variant="outline" onClick={() => setViewGuildInvites(!viewGuildInvites)}>
          {viewGuildInvites ? "Tribe Members" : "Tribe Invites"}
        </Button>
      )}

      <div className="flex-1 min-h-0">
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

      <div className="mt-4 space-y-2">
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
