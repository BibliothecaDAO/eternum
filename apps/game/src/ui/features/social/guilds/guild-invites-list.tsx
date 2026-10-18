import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";

export const GuildInviteList = ({
  invitedPlayers,
  isLoading,
  viewPlayerInfo,
  removePlayerFromWhitelist,
  userIsGuildMaster,
}: {
  invitedPlayers: GuildMemberInfo[];
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
}) => {
  const sortedInvites = useMemo(() => {
    return [...invitedPlayers].sort((a, b) => a.name.localeCompare(b.name));
  }, [invitedPlayers]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        {sortedInvites.map((player) => (
          <InviteRow
            key={`${player.address}-${player.name}`}
            player={player}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            removePlayerFromWhitelist={removePlayerFromWhitelist}
            userIsGuildMaster={userIsGuildMaster}
          />
        ))}
        {!invitedPlayers.length && <p className="py-4 text-center italic text-hud-muted">No Tribe Invites Sent</p>}
      </div>
    </div>
  );
};

const InviteRow = ({
  player,
  isLoading,
  viewPlayerInfo,
  removePlayerFromWhitelist,
  userIsGuildMaster,
}: {
  player: GuildMemberInfo;
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  removePlayerFromWhitelist: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
}) => {
  const setTooltip = useTooltipStore((state) => state.setTooltip);
  const hasPlayerAddress = typeof player.address === "bigint";

  return (
    <div className="mb-1 flex w-full items-center justify-between rounded-lg border border-transparent bg-hud-well px-3 py-2 transition-all duration-200 hover:border-hud-line hover:bg-hud-well">
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          if (!hasPlayerAddress) return;
          viewPlayerInfo(ContractAddress(player.address));
        }}
      >
        <span className="truncate text-hud-strong text-hud-accent">{player.name}</span>
      </button>

      {userIsGuildMaster && hasPlayerAddress ? (
        <SemanticIcon
          name="trash"
          onClick={() => {
            removePlayerFromWhitelist(player.address);
            setTooltip(null);
          }}
          className={clsx("h-5 w-5 opacity-70 transition-all duration-200 hover:opacity-100", {
            "pointer-events-none opacity-50": isLoading,
            "cursor-pointer": !isLoading,
          })}
          onMouseEnter={() =>
            setTooltip({
              content: <div>Revoke tribe invitation</div>,
              position: "top",
            })
          }
          onMouseLeave={() => setTooltip(null)}
        />
      ) : null}
    </div>
  );
};
