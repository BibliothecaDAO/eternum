import { sortItems } from "@/ui/utils/utils";
import { useCallback, useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import Button from "../../../elements/Button";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";

import { ClientComponents } from "@/dojo/createClientComponents";
import { ContractAddress, ID } from "@bibliothecadao/eternum";
import { ComponentValue } from "@dojoengine/recs";
import { GuildAndName, useGuilds } from "../../../../hooks/helpers/useGuilds";
import { GuildMembers } from "./GuildMembers";
import { hasGuild } from "./utils";

type GuildAndNameKeys = keyof (ComponentValue<ClientComponents["Guild"]["schema"]> & {
  name: string;
  rank: string | number;
});
interface SortingParamGuildAndName {
  label: string;
  sortKey: GuildAndNameKeys;
  className?: string;
}

export interface SelectedGuildInterface {
  guildEntityId: ID;
  name: string;
}

export const Guilds = () => {
  const {
    setup: {
      systemCalls: { join_guild },
    },
    account: { account },
  } = useDojo();

  const [_, setIsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState<SelectedGuildInterface>({ guildEntityId: 0, name: "" });

  const { useGuildQuery, getGuildFromPlayerAddress } = useGuilds();

  const { guilds } = useGuildQuery();
  const guildDisplayed = getGuildFromPlayerAddress(ContractAddress(account.address));

  const sortingParams: SortingParamGuildAndName[] = useMemo(() => {
    return [
      { label: "Guild Name", sortKey: "name", className: "col-span-1" },
      { label: "Access", sortKey: "is_public", className: "col-span-1" },
      { label: "Members", sortKey: "member_count", className: "col-span-1" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const joinGuild = useCallback((guildEntityId: ID) => {
    setIsLoading(true);
    join_guild({ guild_entity_id: guildEntityId, signer: account }).finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="flex flex-col">
      {selectedGuild.guildEntityId ? (
        <>
          <div className="relative flex my-1 justify-center">
            <div className="absolute left-0 px-2 flex h-full items-center">
              <Button className="" size="xs" onClick={() => setSelectedGuild({ guildEntityId: 0, name: "" })}>
                Back
              </Button>
            </div>
            <p className="">{selectedGuild.name}</p>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-row justify-between">
              {!hasGuild(guildDisplayed?.guildEntityId) && (
                <div className="px-4 ml-auto">
                  <Button size="xs" onClick={() => joinGuild(selectedGuild.guildEntityId)}>
                    Join Guild
                  </Button>
                </div>
              )}
            </div>

            <GuildMembers selectedGuild={selectedGuild} isOwner={guildDisplayed?.isOwner || false} />
          </div>
        </>
      ) : (
        <div className="flex flex-col">
          <SortPanel className="px-3 py-2 grid grid-cols-4 gap-4">
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
          <div className="flex flex-col p-3 space-y-2 overflow-y-auto ">
            {sortItems(guilds, activeSort)?.map((guild: GuildAndName, index) => {
              return (
                <div
                  key={guild.guild.entity_id}
                  className={`grid grid-cols-4 gap-4 text-md  p-1 ${
                    guild.guild.entity_id === guildDisplayed?.guildEntityId ? "bg-green/20" : ""
                  } `}
                >
                  <p
                    className="col-span-1 hover:text-white truncate"
                    onClick={() => setSelectedGuild({ guildEntityId: guild.guild.entity_id, name: guild.name })}
                  >
                    {guild.name}
                  </p>
                  <p className="col-span-1">{guild.guild.is_public ? "Public" : "Private"}</p>
                  <p className="col-span-1">{guild.guild.member_count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
