import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { useUIStore } from "@/hooks/store/use-ui-store";
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
        {!invitedPlayers.length && <p className="py-4 text-center italic text-gold/70">No Tribe Invites Sent</p>}
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
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div className="mb-1 flex w-full items-center justify-between rounded-lg border border-transparent bg-dark/40 px-3 py-2 transition-all duration-200 hover:border-gold/20 hover:bg-brown/40">
      <button
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          if (!player.address) return;
          viewPlayerInfo(ContractAddress(player.address));
        }}
      >
        <span className="truncate text-sm font-semibold text-gold">{player.name}</span>
      </button>

      {userIsGuildMaster && player.address && (
        <Trash
          onClick={() => {
            removePlayerFromWhitelist(player.address);
            setTooltip(null);
          }}
          className={clsx("h-5 w-5 fill-red/70 transition-all duration-200 hover:scale-110 hover:fill-red/90", {
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
      )}
    </div>
  );
};
