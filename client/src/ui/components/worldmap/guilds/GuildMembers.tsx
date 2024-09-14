import { copyPlayerAddressToClipboard, displayAddress, sortItems } from "@/ui/utils/utils";
import { ContractAddress } from "@bibliothecadao/eternum";
import { useCallback, useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { GuildMemberAndName, useGuilds } from "../../../../hooks/helpers/useGuilds";
import Button from "../../../elements/Button";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { SelectedGuildInterface } from "./Guilds";

interface GuildMembersProps {
  selectedGuild: SelectedGuildInterface;
  isOwner: boolean;
  ownerAddress?: string;
}

type GuildMemberAndNameKeys = keyof GuildMemberAndName;
interface SortingParamGuildMemberAndName {
  label: string;
  sortKey: GuildMemberAndNameKeys;
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

  const sortingParams: SortingParamGuildMemberAndName[] = useMemo(() => {
    return [
      { label: "Player", sortKey: "name", className: "col-span-1" },
      { label: "Address", sortKey: "playerAddress", className: "col-span-1" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const removeGuildMember = useCallback((address: ContractAddress) => {
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
        {sortItems(guildMembers, activeSort)?.map((member: GuildMemberAndName) => {
          return (
            <div
              key={member.guildMember.address}
              className={`grid grid-cols-3 gap-4 text-sm  p-1 ${
                member.playerAddress == account.address ? "bg-green/20" : ""
              } `}
            >
              <p className="col-span-1">{member.name}</p>
              <p
                className="col-span-1 hover:text-white"
                onClick={() => copyPlayerAddressToClipboard(member.guildMember.address, member.name)}
              >
                {displayAddress(member.playerAddress)}
              </p>
              {isOwner &&
                member.playerAddress != account.address &&
                guildOwner?.address == ContractAddress(account.address) && (
                  <div className="col-span-1">
                    <Button
                      size="xs"
                      isLoading={isLoading}
                      onClick={() => removeGuildMember(member.guildMember.address)}
                    >
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
