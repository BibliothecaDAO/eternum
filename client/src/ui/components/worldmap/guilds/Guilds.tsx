import { useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import Button from "../../../elements/Button";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { sortItems } from "@/ui/utils/utils";

import { useGuilds, GuildAndName } from "../../../../hooks/helpers/useGuilds";
import { hasGuild } from "./utils";
import { GuildMembers } from "./GuildMembers";

type GuildAndNameKeys = keyof GuildAndName;
interface SortingParamGuildAndName {
  label: string;
  sortKey: GuildAndNameKeys;
  className?: string;
}

export const Guilds = () => {
  const {
    setup: {
      systemCalls: { join_guild },
    },
    account: { account },
  } = useDojo();

  const [_, setIsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState({ id: 0n, name: "" });

  const { getGuilds, getGuildMembers, getAddressGuild } = useGuilds();

  const { guilds } = getGuilds();
  const { guildMembers } = getGuildMembers(selectedGuild.id);
  const { userGuildEntityId, isOwner } = getAddressGuild(account.address);

  const sortingParams: SortingParamGuildAndName[] = useMemo(() => {
    return [
      { label: "Rank", sortKey: "rank", className: "col-span-1" },
      { label: "Guild Name", sortKey: "name", className: "col-span-1" },
      { label: "Access", sortKey: "is_public", className: "col-span-1" },
      { label: "Members", sortKey: "member_count", className: "col-span-1" },
    ];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const joinGuild = (guildEntityId: bigint) => {
    setIsLoading(true);
    join_guild({ guild_entity_id: guildEntityId, signer: account }).finally(() => setIsLoading(false));
  };

  return (
    <div className="flex flex-col">
      {selectedGuild.id ? (
        <>
          <div className="relative flex my-1 justify-center">
            <div className="absolute left-0 px-2 flex h-full items-center">
              <Button className="" size="xs" onClick={() => setSelectedGuild({ id: 0n, name: "" })}>
                Back
              </Button>
            </div>
            <p className="">{selectedGuild.name}</p>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-row justify-between">
              {!hasGuild(userGuildEntityId) && (
                <div className="px-4 ml-auto">
                  <Button size="xs" onClick={() => joinGuild(selectedGuild.id)}>
                    Join Guild
                  </Button>
                </div>
              )}
            </div>

            <GuildMembers guildMembers={guildMembers} isOwner={isOwner} />
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
          <div className="flex flex-col p-3 space-y-2 overflow-y-auto">
            {sortItems(guilds, activeSort)?.map((guild: GuildAndName) => {
              return (
                <div
                  key={guild.entity_id}
                  className={`grid grid-cols-4 gap-4 text-xs clip-angled-sm p-1 ${
                    userGuildEntityId === BigInt(guild.entity_id) ? "bg-green/20" : ""
                  } `}
                >
                  <p className="col-span-1">{`#${guild.rank}`} </p>
                  <p
                    className="col-span-1 hover:text-white truncate"
                    onClick={() => setSelectedGuild({ id: BigInt(guild.entity_id), name: guild.name })}
                  >
                    {guild.name}
                  </p>
                  <p className="col-span-1">{guild.is_public ? "Public" : "Private"}</p>
                  <p className="col-span-1">{guild.member_count}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
