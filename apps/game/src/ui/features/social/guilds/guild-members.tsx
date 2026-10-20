import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import TwitterShareButton from "@/ui/design-system/molecules/twitter-share-button";
import { GuildInviteList } from "@/ui/features/social/guilds/guild-invites-list";
import { GuildMemberList } from "./guild-member-list";
import { useSocialStore } from "../components/use-social-store";
import { formatSocialText, twitterTemplates } from "@/ui/socials";
import { getGuild, getGuildFromPlayerAddress, isViewerOwner } from "@bibliothecadao/eternum";
import { useGame } from "@/hooks/context/game-context";
import { useGuildMembers, useGuildWhitelist } from "@/hooks/helpers/use-guilds";
import { ContractAddress, PlayerInfo } from "@bibliothecadao/types";

import { useCallback, useMemo, useState } from "react";

import { env } from "../../../../../env";
import { HudButton, HudTabs } from "@/ui/design-system/kit/hud-elements";

interface GuildMembersProps {
  players: PlayerInfo[];
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  setIsExpanded: (isExpanded: boolean) => void;
}

export const GuildMembers = ({ players, viewPlayerInfo, setIsExpanded }: GuildMembersProps) => {
  const {
    setup: {
      store,
      systemCalls: { join_guild, remove_guild_member, disband_guild, update_whitelist, leave_guild },
    },
    account: { account },
  } = useGame();

  const selectedGuildEntityId = useSocialStore((state) => state.selectedGuild);
  const guildMembers = useGuildMembers(selectedGuildEntityId);
  const invitedPlayers = useGuildWhitelist(selectedGuildEntityId);
  const userGuild = getGuildFromPlayerAddress(ContractAddress(account.address), store);
  const selectedGuild = getGuild(selectedGuildEntityId, ContractAddress(account.address), store);

  const [isLoading, setIsLoading] = useState(false);
  const [viewGuildInvites, setViewGuildInvites] = useState(false);

  const memberCount = guildMembers.length;
  const inviteCount = invitedPlayers.length;
  const userIsGuildMaster = userGuild?.isOwner ? userGuild.entityId === selectedGuildEntityId : false;

  const userIsInvited = useMemo(() => {
    return invitedPlayers.some((list) => isViewerOwner(list.address, ContractAddress(account.address)));
  }, [invitedPlayers, account.address]);

  const guildMasterName = useMemo(() => {
    const guildMaster = guildMembers.find((member) => member.isGuildMaster);
    if (!guildMaster) return "Unknown";

    return players.find((player) => player.address === guildMaster.address)?.name ?? "Unknown";
  }, [guildMembers, players]);

  const playerName = useMemo(() => {
    return players.find((player) => isViewerOwner(player.address, ContractAddress(account.address)))?.name;
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

  // Written when Share is pressed, as every shared line is.
  const shareTribe =
    userGuild?.entityId === selectedGuildEntityId
      ? () =>
          formatSocialText(userGuild?.isOwner ? twitterTemplates.createdTribe : twitterTemplates.joinedTribe, {
            tribeName: selectedGuild?.name,
            addressName: playerName,
            url: env.VITE_SOCIAL_LINK,
          })
      : undefined;

  return (
    <div className="flex min-h-72 h-full w-full flex-col overflow-hidden p-2">
      <div className="mb-4 rounded-xl border border-hud-line bg-hud-well p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate text-hud-title text-hud-accent">{selectedGuild?.name || "Tribe"}</h2>
            <p className="mt-1 text-hud-label uppercase text-hud-muted">
              {selectedGuild?.isPublic ? "Public Tribe" : "Private Tribe"}
            </p>
          </div>
          {shareTribe && <TwitterShareButton text={shareTribe} />}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <GuildMetaPill icon={"defend" as const} label="Chief" value={guildMasterName} />
          <GuildMetaPill icon={"people" as const} label="Members" value={String(memberCount)} />
          <GuildMetaPill icon={"mail" as const} label="Invites" value={String(inviteCount)} />
          <GuildMetaPill
            icon={"calendar" as const}
            label="Status"
            value={selectedGuild?.isPublic ? "Open" : "Invite"}
          />
        </div>
      </div>

      {userIsGuildMaster && (
        <div className="mb-3 grid grid-cols-2 gap-2">
          <HudTabs
            tabs={[
              { key: "members", label: "Members", count: memberCount, icon: "people" },
              { key: "invites", label: "Invites", count: inviteCount, icon: "mail" },
            ]}
            value={viewGuildInvites ? "invites" : "members"}
            onChange={(key) => setViewGuildInvites(key === "invites")}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-hud-divider bg-hud-well p-2">
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
          <HudButton
            kind="danger"
            icon="minus"
            busy={isLoading ? "Leaving…" : undefined}
            onClick={() => (userGuild.isOwner ? disbandGuild() : leaveGuild())}
          >
            {userGuild.isOwner ? "Disband Tribe" : "Leave Tribe"}
          </HudButton>
        )}
        {!userGuild?.entityId && (selectedGuild?.isPublic || userIsInvited) && (
          <HudButton
            kind="primary"
            busy={isLoading ? "Joining…" : undefined}
            onClick={() => joinGuild(selectedGuildEntityId)}
          >
            Join Tribe
          </HudButton>
        )}
      </div>
    </div>
  );
};

const GuildMetaPill = ({ icon: Icon, label, value }: { icon: IconMeaning; label: string; value: string }) => (
  <div className="rounded-md border border-hud-divider bg-hud-well px-2 py-1.5 text-hud-label">
    <div className="flex items-center gap-1 text-hud-muted">
      <SemanticIcon name={Icon} className="h-3.5 w-3.5" />
      <span className="uppercase">{label}</span>
    </div>
    <div className="mt-1 truncate text-hud-strong text-hud-accent">{value}</div>
  </div>
);
