import { GuildInviteList } from "@/ui/components/worldmap/guilds/guild-invites-list";
import { GuildMemberList } from "@/ui/components/worldmap/guilds/guild-member-list";
import Button from "@/ui/elements/button";
import TextInput from "@/ui/elements/text-input";
import TwitterShareButton from "@/ui/elements/twitter-share-button";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import { getGuild, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers, useGuildWhitelist, usePlayerWhitelist } from "@bibliothecadao/react";
import { Building, CalendarDays, Edit, Mail, Shield, UserMinus, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
      systemCalls: { join_guild, remove_guild_member, disband_guild, update_whitelist, set_entity_name },
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
  const textInputRef = useRef<HTMLInputElement>(null);

  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;
  const userIsInvited = userWhitelist.find((list) => list.entityId === selectedGuildEntityId);

  // Calculate some stats
  const memberCount = guildMembers.length;
  const inviteCount = invitedPlayers.length;
  const guildMaster = guildMembers.find((member) => member.isGuildMaster);
  const guildMasterName = guildMaster
    ? players.find((player) => player.address === guildMaster.address)?.name
    : "Unknown";

  // Set initial naming value when editing
  useEffect(() => {
    if (editName && selectedGuild?.name) {
      setNaming(selectedGuild.name);
      // Focus the input field when it becomes visible
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
        }
      }, 100);
    }
  }, [editName, selectedGuild?.name]);

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
    const calldata = [
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

  const handleChangeName = async () => {
    if (!naming.trim()) return;

    setIsLoading(true);
    try {
      await set_entity_name({ signer: account, entity_id: selectedGuildEntityId, name: naming });
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
    setEditName(false);
  };

  return (
    <div className="flex flex-col min-h-72 h-full w-full p-4 overflow-hidden">
      {/* Guild Header */}
      <div className="border-b border-gold/20 pb-4 mb-4">
        {editName ? (
          <div className="flex flex-col space-y-2 mb-4">
            <div className="flex items-center">
              <Edit size={16} className="text-gold/80 mr-2" />
              <h3 className="text-gold/90 text-sm font-semibold">Rename Tribe</h3>
            </div>

            <div className="flex gap-2">
              <TextInput
                ref={textInputRef}
                placeholder="New Name"
                className="flex-1"
                onChange={(name) => setNaming(name)}
              />
              <Button variant="primary" isLoading={isLoading} onClick={handleChangeName} className="whitespace-nowrap">
                Save Name
              </Button>
              <Button variant="outline" onClick={() => setEditName(false)} className="px-3">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="truncate font-bold text-gold text-xl flex items-center">
                <Building size={20} className="mr-2 text-gold/80" />
                {selectedGuild?.name || "Tribe"}
              </h2>
              <div className="flex items-center gap-2">
                {userIsGuildMaster && (
                  <button
                    className="p-1.5 rounded-full hover:bg-brown/20 transition-colors"
                    onClick={() => setEditName(!editName)}
                  >
                    <Edit size={16} className="text-gold/80" />
                  </button>
                )}
                {socialsText && (
                  <div>
                    <TwitterShareButton text={socialsText} />
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2 bg-brown/10 p-2 rounded">
                <Shield size={14} className="text-gold/80" />
                <span className="text-gold/90">Chief: {guildMasterName}</span>
              </div>
              <div className="flex items-center gap-2 bg-brown/10 p-2 rounded">
                <Users size={14} className="text-gold/80" />
                <span className="text-gold/90">Members: {memberCount}</span>
              </div>
              <div className="flex items-center gap-2 bg-brown/10 p-2 rounded">
                <Mail size={14} className="text-gold/80" />
                <span className="text-gold/90">Invites: {inviteCount}</span>
              </div>
              <div className="flex items-center gap-2 bg-brown/10 p-2 rounded">
                <CalendarDays size={14} className="text-gold/80" />
                <span className="text-gold/90">{selectedGuild?.isPublic ? "Public Tribe" : "Private Tribe"}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Selection - Members vs Invites */}
      {userIsGuildMaster && (
        <div className="mb-4 flex">
          <Button
            className={`flex-1 flex items-center justify-center gap-1 ${!viewGuildInvites ? "bg-brown/20" : ""}`}
            variant="outline"
            onClick={() => setViewGuildInvites(false)}
          >
            <Users size={16} />
            <span>Members ({memberCount})</span>
          </Button>
          <Button
            className={`flex-1 flex items-center justify-center gap-1 ${viewGuildInvites ? "bg-brown/20" : ""}`}
            variant="outline"
            onClick={() => setViewGuildInvites(true)}
          >
            <Mail size={16} />
            <span>Invites ({inviteCount})</span>
          </Button>
        </div>
      )}

      {/* Member or Invite List */}
      <div className="flex-1 min-h-0 border border-gold/10 rounded-md bg-brown/5">
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

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        {userGuild?.entityId === selectedGuildEntityId && (
          <Button
            className="flex-1 flex items-center justify-center gap-1"
            isLoading={isLoading}
            variant="red"
            onClick={() => (userGuild.isOwner ? disbandGuild() : removeGuildMember(ContractAddress(account.address)))}
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
