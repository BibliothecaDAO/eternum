import Button from "@/ui/elements/button";
import TwitterShareButton from "@/ui/elements/twitter-share-button";
import { useSocialStore } from "@/ui/features/social";
import { GuildMemberList } from "@/ui/features/world/components/guilds/guild-member-list";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getGuild, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers, useGuildWhitelist } from "@bibliothecadao/react";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { CalendarDays, Mail, Shield, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "../../../../../env";
import { GuildInviteList } from "./guild-invites-list";

interface GuildMembersProps {
  players: PlayerInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  setIsExpanded: (isExpanded: boolean) => void;
  isOwner?: boolean;
  ownerAddress?: string;
}

export const GuildMembers = ({ players, viewPlayerInfo, setIsExpanded }: GuildMembersProps) => {
  const {
    setup: {
      components,
      systemCalls: { join_guild, remove_guild_member, disband_guild, update_whitelist, leave_guild },
    },
    account: { account },
  } = useDojo();

  const selectedGuildEntityId = useSocialStore((state) => state.selectedGuild);

  const guildMembers = useGuildMembers(selectedGuildEntityId);

  const invitedPlayers = useGuildWhitelist(selectedGuildEntityId);

  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), components);

  const selectedGuild = getGuild(selectedGuildEntityId, ContractAddress(account.address), components);

  const playerName = players.find((player) => player.address === ContractAddress(account?.address))?.name;

  const [editName, setEditName] = useState(false);
  const [naming, setNaming] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);

  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;

  const userIsInvited = invitedPlayers.find((list) => list.address === ContractAddress(account.address));

  const memberCount = guildMembers.length;
  const inviteCount = invitedPlayers.length;

  const guildMaster = guildMembers.find((member) => member.isGuildMaster);
  const guildMasterName = guildMaster
    ? players.find((player) => player.address === guildMaster.address)?.name
    : "Unknown";

  useEffect(() => {
    if (editName && selectedGuild?.name) {
      setNaming(selectedGuild.name);

      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 100);
    }
  }, [editName, selectedGuild?.name]);

  const leaveGuild = useCallback(() => {
    setIsLoading(true);
    leave_guild({ signer: account }).finally(() => setIsLoading(false));
  }, []);

  const removeGuildMember = useCallback((address: ContractAddress) => {
    console.log("removeGuildMember", address);
    setIsLoading(true);
    remove_guild_member({
      player_address_to_remove: address,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  const disbandGuild = () => {
    const calldata = [
      ...guildMembers
        .filter((member) => member.address !== ContractAddress(account.address))
        .map((member) => ({
          address: member.address,
        })),
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

  const joinGuild = async (guildEntityId: ContractAddress) => {
    setIsLoading(true);
    try {
      await join_guild({ guild_entity_id: guildEntityId, signer: account });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const removePlayerFromWhitelist = (address: ContractAddress) => {
    setIsLoading(true);
    update_whitelist({
      address,
      whitelist: false,
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
      <div className="pb-2">
        <div className="flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="truncate flex items-center">{selectedGuild?.name || "Tribe"}</h2>
            <div className="flex items-center gap-2">{socialsText && <TwitterShareButton text={socialsText} />}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2 bg-brown/10 rounded">
              <Shield size={14} className="text-gold/80" />
              <span className="text-gold/90 h5">Chief: {guildMasterName}</span>
            </div>
            <div className="flex items-center gap-2 bg-brown/10 rounded">
              <Users size={14} className="text-gold/80" />
              <span className="text-gold/90 h5">Members: {memberCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-brown/10 rounded">
              <Mail size={14} className="text-gold/80" />
              <span className="text-gold/90 h5">Invites: {inviteCount}</span>
            </div>
            <div className="flex items-center gap-2 bg-brown/10 rounded">
              <CalendarDays size={14} className="text-gold/80" />
              <span className="text-gold/90 h5">{selectedGuild?.isPublic ? "Public Tribe" : "Private Tribe"}</span>
            </div>
          </div>
        </div>
        {/* )} */}
      </div>
      {/* Tab Selection - Members vs Invites */}
      {userIsGuildMaster && (
        <div className="mb-4 flex gap-4">
          <Button
            className={`flex-1 flex items-center justify-center gap-1 ${!viewGuildInvites ? "bg-brown/20" : ""}`}
            variant="outline"
            size="xs"
            onClick={() => setViewGuildInvites(false)}
          >
            <Users size={16} />
            <span>Members ({memberCount})</span>
          </Button>
          <Button
            className={`flex-1 flex items-center justify-center gap-1 ${viewGuildInvites ? "bg-brown/20" : ""}`}
            variant="outline"
            size="xs"
            onClick={() => setViewGuildInvites(true)}
          >
            <Mail size={16} />
            <span>Invites ({inviteCount})</span>
          </Button>
        </div>
      )}
      {/* Member or Invite List */}
      <div className="flex gap-2 justify-between">
        <Button size="xs" onClick={() => setViewGuildInvites(false)}>
          Members
        </Button>
        <Button size="xs" onClick={() => setViewGuildInvites(true)}>
          Invites
        </Button>
      </div>

      <div className="flex-1 min-h-0 border border-gold/10 rounded-md bg-brown/5">
        {viewGuildInvites ? (
          <GuildInviteList
            invitedPlayers={invitedPlayers}
            isLoading={isLoading}
            userIsGuildMaster={userIsGuildMaster}
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
      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        {userGuild?.entityId === selectedGuildEntityId && (
          <Button
            className="flex-1 flex items-center justify-center gap-1"
            isLoading={isLoading}
            variant="red"
            onClick={() => (userGuild.isOwner ? disbandGuild() : leaveGuild())}
          >
            <UserMinus size={16} />
            <span>{userGuild.isOwner ? "Disband Tribe" : "Leave Tribe"}</span>
          </Button>
        )}
        {!userGuild?.entityId && (!selectedGuild?.isPublic ? userIsInvited : true) && (
          <Button
            className="flex-1"
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
