import { ReactComponent as Trash } from "@/assets/icons/common/trashcan.svg";
import { ReactComponent as Crown } from "@/assets/icons/crown.svg";
import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";

interface GuildMemberListProps {
  guildMembers: GuildMemberInfo[];
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

interface GuildMemberRowProps {
  guildMember: GuildMemberInfo;
  isLoading: boolean;
  viewPlayerInfo: (playerAddress: ContractAddress) => void;
  userIsGuildMaster: boolean;
  removeGuildMember: (playerAddress: ContractAddress) => void;
}

export const GuildMemberList = ({
  guildMembers,
  isLoading,
  viewPlayerInfo,
  userIsGuildMaster,
  removeGuildMember,
}: GuildMemberListProps) => {
  const sortedGuildMembers = useMemo(() => {
    return [...guildMembers].sort((a, b) => a.name.localeCompare(b.name));
  }, [guildMembers]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/20 scrollbar-track-transparent">
        {sortedGuildMembers.map((guildMember) => (
          <GuildMemberRow
            key={guildMember.address}
            guildMember={guildMember}
            isLoading={isLoading}
            viewPlayerInfo={viewPlayerInfo}
            userIsGuildMaster={userIsGuildMaster}
            removeGuildMember={removeGuildMember}
          />
        ))}
        {!guildMembers.length && <p className="py-4 text-center italic text-gold/70">No Tribe Members</p>}
      </div>
    </div>
  );
};

const GuildMemberRow = ({
  guildMember,
  isLoading,
  viewPlayerInfo,
  userIsGuildMaster,
  removeGuildMember,
}: GuildMemberRowProps) => {
  const kickButtonEnabled = userIsGuildMaster && !guildMember.isUser;

  return (
    <div
      className={clsx(
        "mb-1 flex w-full items-center justify-between rounded-lg border border-transparent bg-dark/40 px-3 py-2 transition-all duration-200",
        guildMember.isUser && "border-gold/45 bg-gold/15",
        !guildMember.isUser && "hover:border-gold/20 hover:bg-brown/40",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        {guildMember.isGuildMaster && <Crown className="h-4 w-4 shrink-0 fill-gold" />}
        <span className="truncate text-sm font-semibold text-gold">{guildMember.name}</span>
        {guildMember.isUser && (
          <span className="shrink-0 rounded-full border border-amber-200/50 bg-amber-200/20 px-2 py-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-amber-200">
            You
          </span>
        )}
      </button>

      {kickButtonEnabled && (
        <Trash
          onClick={() => removeGuildMember(guildMember.address)}
          className={clsx("h-5 w-5 fill-red/70 transition-all duration-200 hover:scale-110 hover:fill-red/90", {
            "pointer-events-none opacity-50": isLoading,
            "cursor-pointer": !isLoading,
          })}
        />
      )}
    </div>
  );
};
