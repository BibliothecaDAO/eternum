import { Icon as SemanticIcon } from "@/ui/design-system/icon";

import { ContractAddress, GuildMemberInfo } from "@bibliothecadao/types";
import clsx from "clsx";
import { useMemo } from "react";
import { HudChip } from "@/ui/design-system/kit/hud-elements";

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
      <div className="flex-1 overflow-y-auto">
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
        {!guildMembers.length && <p className="py-4 text-center italic text-hud-muted">No Tribe Members</p>}
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
        "mb-1 flex w-full items-center justify-between rounded-lg border border-transparent bg-hud-well px-3 py-2 transition-all duration-200",
        guildMember.isUser && "border-hud-line-strong bg-hud-chosen",
        !guildMember.isUser && "hover:border-hud-line hover:bg-hud-well",
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => {
          viewPlayerInfo(ContractAddress(guildMember.address));
        }}
      >
        {guildMember.isGuildMaster && <SemanticIcon name="crown" className="h-4 w-4 shrink-0 " />}
        <span className="truncate text-hud-strong text-hud-accent">{guildMember.name}</span>
        {guildMember.isUser && <HudChip tone="warn">You</HudChip>}
      </button>

      {kickButtonEnabled && (
        <SemanticIcon
          name="trash"
          onClick={() => removeGuildMember(guildMember.address)}
          className={clsx("h-5 w-5 opacity-70 transition-all duration-200 hover:opacity-100", {
            "pointer-events-none opacity-50": isLoading,
            "cursor-pointer": !isLoading,
          })}
        />
      )}
    </div>
  );
};
