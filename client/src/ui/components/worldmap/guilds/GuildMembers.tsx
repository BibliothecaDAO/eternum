import { useMemo, useState, useCallback } from "react";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { GuildMember } from "../../../../hooks/helpers/useGuilds";
import { displayAddress, sortItems, copyPlayerAddressToClipboard } from "@/ui/utils/utils";
import Button from "../../../elements/Button";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { useGuilds } from "../../../../hooks/helpers/useGuilds";
import { SelectedGuildInterface } from "./Guilds";

interface GuildMembersProps {
  selectedGuild: SelectedGuildInterface;
  isOwner: boolean;
  ownerAddress?: string;
}

type GuildMemberKeys = keyof GuildMember;
interface SortingParamGuildMember {
  label: string;
  sortKey: GuildMemberKeys;
  className?: string;
}

export const GuildMembers = ({ selectedGuild, isOwner, ownerAddress }: GuildMembersProps) => {
  const {
    setup: {
      systemCalls: { remove_guild_member },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);

  const { useGuildMembers, getGuildOwner } = useGuilds();
  const { guildMembers } = useGuildMembers(selectedGuild.guildEntityId);

  const guildOwner = getGuildOwner(selectedGuild.guildEntityId);

  const sortingParams: SortingParamGuildMember[] = useMemo(() => {
    return [
      { label: "Player", sortKey: "name", className: "col-span-1" },
      { label: "Address", sortKey: "playerAddress", className: "col-span-1" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const removeGuildMember = useCallback((address: bigint) => {
    setIsLoading(true);
    remove_guild_member({
      player_address_to_remove: address,
      signer: account,
    }).finally(() => {
      setIsLoading(false);
    });
  }, []);

  return (
    <>
      <SortPanel className="px-3 py-2 grid grid-cols-3 gap-4">
        {sortingParams.map(({ label, sortKey, className }) => (
          <SortButton
            className={className}
            key={sortKey}
            label={label}
            sortKey={sortKey}
            activeSort={activeSort}
            onChange={(_sortKey, _sort) => {
              setActiveSort({
                sortKey: _sortKey,
                sort: _sort,
              });
            }}
          />
        ))}
      </SortPanel>
      <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
        {sortItems(guildMembers, activeSort)?.map((member: GuildMember) => {
          return (
            <div
              key={member.address}
              className={`grid grid-cols-3 gap-4 text-sm clip-angled-sm p-1 ${
                member.playerAddress == account.address ? "bg-green/20" : ""
              } `}
            >
              <p className="col-span-1">{member.name}</p>
              <p
                className="col-span-1 hover:text-white"
                onClick={() => copyPlayerAddressToClipboard(BigInt(member.address), member.name)}
              >
                {displayAddress(member.playerAddress)}
              </p>
              {isOwner && member.playerAddress != account.address && guildOwner?.address == BigInt(account.address) && (
                <div className="col-span-1">
                  <Button size="xs" isLoading={isLoading} onClick={() => removeGuildMember(BigInt(member.address))}>
                    Kick out
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
};
