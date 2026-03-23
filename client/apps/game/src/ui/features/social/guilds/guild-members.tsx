import Button from "@/ui/design-system/atoms/button";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import { GuildInviteList } from "@/ui/features/social/guilds/guild-invites-list";
import { GuildMemberList, useSocialStore } from "@/ui/features/social";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getGuild, getGuildFromPlayerAddress } from "@bibliothecadao/eternum";
import { useDojo, useGuildMembers, useGuildWhitelist } from "@bibliothecadao/react";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";
import CalendarDays from "lucide-react/dist/esm/icons/calendar-days";
import Mail from "lucide-react/dist/esm/icons/mail";
import Shield from "lucide-react/dist/esm/icons/shield";
import UserMinus from "lucide-react/dist/esm/icons/user-minus";
import Users from "lucide-react/dist/esm/icons/users";
import { useCallback, useMemo, useState } from "react";

import { env } from "../../../../../env";

interface GuildMembersProps {
  players: PlayerInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  setIsExpanded: (isExpanded: boolean) => void;
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

  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);

  const memberCount = guildMembers.length;
  const inviteCount = invitedPlayers.length;
  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;

  const userIsInvited = useMemo(() => {
    return invitedPlayers.some((list) => list.address === ContractAddress(account.address));
  }, [invitedPlayers, account.address]);

  const guildMasterName = useMemo(() => {
    const guildMaster = guildMembers.find((member) => member.isGuildMaster);
    if (!guildMaster) return "Unknown";

    return players.find((player) => player.address === guildMaster.address)?.name ?? "Unknown";
  }, [guildMembers, players]);

  const playerName = useMemo(() => {
    return players.find((player) => player.address === ContractAddress(account.address))?.name;
  }, [players, account.address]);

  const leaveGuild = useCallback(() => {
    setIsLoading(true);
    leave_guild({ signer: account }).finally(() => setIsLoading(false));
  }, [leave_guild, account]);

  const removeGuildMember = useCallback(
    (address: ContractAddress) => {
      setIsLoading(true);
      remove_guild_member({
        player_address_to_remove: address,
        signer: account,
      }).finally(() => {
        setIsLoading(false);
      });
    },
    [remove_guild_member, account],
  );

  const disbandGuild = useCallback(() => {
    const calldata = [
      ...guildMembers
        .filter((member) => member.address !== ContractAddress(account.address))
        .map((member) => ({ address: member.address })),
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
  }, [guildMembers, account, disband_guild, setIsExpanded]);

  const joinGuild = useCallback(
    async (guildEntityId: ContractAddress) => {
      setIsLoading(true);
      try {
        await join_guild({ guild_entity_id: guildEntityId, signer: account });
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    },
    [join_guild, account],
  );

  const removePlayerFromWhitelist = useCallback(
    (address: ContractAddress) => {
      setIsLoading(true);
      update_whitelist({
        address,
        whitelist: false,
        signer: account,
      }).finally(() => setIsLoading(false));
    },
    [update_whitelist, account],
  );

  const socialsText =
    userGuild?.entityId === selectedGuildEntityId
      ? formatSocialText(userGuild?.isOwner ? twitterTemplates.createdTribe : twitterTemplates.joinedTribe, {
          tribeName: selectedGuild?.name,
          addressName: playerName,
          url: env.VITE_SOCIAL_LINK,
        })
      : undefined;

  return (
    <div className="flex min-h-72 h-full w-full flex-col overflow-hidden p-2">
      <div className="mb-4 rounded-xl border border-gold/20 bg-dark/45 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gold">{selectedGuild?.name || "Tribe"}</h2>
            <p className="mt-1 text-[0.7rem] uppercase tracking-[0.16em] text-gold/65">
              {selectedGuild?.isPublic ? "Public Tribe" : "Private Tribe"}
            </p>
          </div>
          {socialsText && <TwitterShareButton text={socialsText} />}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <GuildMetaPill icon={Shield} label="Chief" value={guildMasterName} />
          <GuildMetaPill icon={Users} label="Members" value={String(memberCount)} />
          <GuildMetaPill icon={Mail} label="Invites" value={String(inviteCount)} />
          <GuildMetaPill icon={CalendarDays} label="Status" value={selectedGuild?.isPublic ? "Open" : "Invite"} />
        </div>
      </div>

      {userIsGuildMaster && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <Button
            className={`flex items-center justify-center gap-1.5 ${viewGuildInvites ? "" : "bg-gold/10 border-gold/40"}`}
            variant="outline"
            size="xs"
            onClick={() => setViewGuildInvites(false)}
          >
            <Users className="h-4 w-4" />
            <span>Members ({memberCount})</span>
          </Button>
          <Button
            className={`flex items-center justify-center gap-1.5 ${viewGuildInvites ? "bg-gold/10 border-gold/40" : ""}`}
            variant="outline"
            size="xs"
            onClick={() => setViewGuildInvites(true)}
          >
            <Mail className="h-4 w-4" />
            <span>Invites ({inviteCount})</span>
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-gold/15 bg-dark/40 p-2">
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

      <div className="mt-4 flex flex-wrap gap-2">
        {userGuild?.entityId === selectedGuildEntityId && (
          <Button
            className="flex-1 flex items-center justify-center gap-1.5"
            isLoading={isLoading}
            variant="red"
            onClick={() => (userGuild.isOwner ? disbandGuild() : leaveGuild())}
          >
            <UserMinus className="h-4 w-4" />
            <span>{userGuild.isOwner ? "Disband Tribe" : "Leave Tribe"}</span>
          </Button>
        )}
        {!userGuild?.entityId && (selectedGuild?.isPublic || userIsInvited) && (
          <Button
            className="flex-1 flex items-center justify-center gap-1.5"
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

const GuildMetaPill = ({ icon: Icon, label, value }: { icon: typeof Shield; label: string; value: string }) => (
  <div className="rounded-md border border-gold/15 bg-black/25 px-2 py-1.5 text-xs">
    <div className="flex items-center gap-1 text-gold/65">
      <Icon className="h-3.5 w-3.5" />
      <span className="uppercase tracking-[0.14em]">{label}</span>
    </div>
    <div className="mt-1 truncate font-semibold text-gold">{value}</div>
  </div>
);
