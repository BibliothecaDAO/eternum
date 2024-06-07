import { useMemo, useState, useCallback } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import Button from "../../../elements/Button";

import { useGuilds, AddressWhitelistAndName, GuildWhitelistAndName } from "../../../../hooks/helpers/useGuilds";
import { hasGuild } from "./utils";
import { GuildMembers } from "./GuildMembers";
import { sortItems } from "@/ui/utils/utils";
import { SelectedGuildInterface } from "./Guilds";

type GuildWhitelistAndNameKeys = keyof GuildWhitelistAndName;
interface SortingParamGuildWhitelistAndName {
  label: string;
  sortKey: GuildWhitelistAndNameKeys;
  className?: string;
}

export const GuildInvites = () => {
  const {
    setup: {
      systemCalls: { join_guild, remove_player_from_whitelist },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<SelectedGuildInterface>({ guildEntityId: 0n, name: "" });

  const { getAddressWhitelist, getAddressGuild } = useGuilds();

  const { addressWhitelist } = getAddressWhitelist(BigInt(account.address));
  const { userGuildEntityId } = getAddressGuild(account.address);

  const sortingParams: SortingParamGuildWhitelistAndName[] = useMemo(() => {
    return [{ label: "Guild Name", sortKey: "name", className: "col-span-1" }];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const joinGuild = useCallback((guildEntityId: bigint) => {
    setIsLoading(true);
    join_guild({ guild_entity_id: guildEntityId, signer: account }).finally(() => setIsLoading(false));
  }, []);

  const removePlayerFromWhitelist = useCallback((guildEntityId: bigint) => {
    setIsLoading(true);
    remove_player_from_whitelist({
      player_address_to_remove: account.address,
      guild_entity_id: guildEntityId,
      signer: account,
    }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col">
      {selectedGuild.guildEntityId ? (
        <>
          <p className="flex justify-center py-2">{selectedGuild.name}</p>
          <div className="flex flex-col">
            <div className="flex flex-row justify-between">
              <div className="px-4">
                <Button size="xs" onClick={() => setSelectedGuild({ guildEntityId: 0n, name: "" })}>
                  Back
                </Button>
              </div>

              {!hasGuild(userGuildEntityId) && (
                <div className="px-4">
                  <Button onClick={() => joinGuild(selectedGuild.guildEntityId)}>Join Guild</Button>
                </div>
              )}
            </div>
            <GuildMembers selectedGuild={selectedGuild} isOwner={false} />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col">
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
              {sortItems(addressWhitelist, activeSort)?.map((addressWhitelist: AddressWhitelistAndName, index) => {
                return (
                  <div key={addressWhitelist.guild_entity_id} className="grid grid-cols-3 gap-4 text-xs">
                    <p
                      className="col-span-1  hover:text-white  truncate"
                      onClick={() =>
                        setSelectedGuild({
                          guildEntityId: BigInt(addressWhitelist.guild_entity_id),
                          name: addressWhitelist.name,
                        })
                      }
                    >
                      {addressWhitelist.name}
                    </p>
                    <div className="col-span-1">
                      <Button
                        size="xs"
                        isLoading={isLoading}
                        onClick={() => removePlayerFromWhitelist(BigInt(addressWhitelist.guild_entity_id))}
                      >
                        Refuse
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
