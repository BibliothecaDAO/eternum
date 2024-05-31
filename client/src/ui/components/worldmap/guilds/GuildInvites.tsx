import { useMemo, useState } from "react";
import { useDojo } from "../../../../hooks/context/DojoContext";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import Button from "../../../elements/Button";

import {
  useGuildInvites,
  GuildInviteAndName,
  useUserGuild,
  useGuildMembers,
} from "../../../../hooks/helpers/useGuilds";
import { hasGuild } from "./utils";
import { GuildMembers } from "./GuildMembers";

export const GuildInvites = () => {
  const {
    setup: {
      systemCalls: { join_guild },
    },
    account: { account },
  } = useDojo();

  const [_, setIsLoading] = useState(false);
  const [selectedGuild, setSelectedGuild] = useState({ id: 0n, name: "" });

  const { invites } = useGuildInvites(BigInt(account.address));
  const { userGuildEntityId } = useUserGuild();
  const { guildMembers } = useGuildMembers(selectedGuild.id);

  const sortingParams = useMemo(() => {
    return [{ label: "Guild Name", sortKey: "name", className: "w-1/6" }];
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
          <p className="flex justify-center py-2">{selectedGuild.name}</p>
          <div className="flex flex-col">
            <div className="flex flex-row justify-between">
              <div className="px-4">
                <Button onClick={() => setSelectedGuild({ id: 0n, name: "" })}>Back</Button>
              </div>

              {!hasGuild(userGuildEntityId) && (
                <div className="px-4">
                  <Button onClick={() => joinGuild(selectedGuild.id)}>Join Guild</Button>
                </div>
              )}
            </div>
            <GuildMembers guildMembers={guildMembers} />
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col">
            <SortPanel className="px-3 py-2">
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
            <div className="py-2">
              {sortInvites(invites, activeSort)?.map((invite: GuildInviteAndName, index) => {
                return (
                  <div key={index} className="flex px-3 text-xs">
                    <p
                      className="w-1/6  hover:text-white  truncate"
                      onClick={() => setSelectedGuild({ id: BigInt(invite.guild_entity_id), name: invite.name })}
                    >
                      {invite.name}
                    </p>
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

export function sortInvites(
  invites: GuildInviteAndName[],
  activeSort: SortInterface,
): GuildInviteAndName[] | undefined {
  const sortedInvites = [...invites];

  if (activeSort.sort !== "none") {
    if (activeSort.sortKey === "name") {
      return sortedInvites.sort((a, b) => {
        if (activeSort.sort === "asc") {
          return a.name.localeCompare(b.name);
        } else {
          return b.name.localeCompare(a.name);
        }
      });
    }
  }
  return sortedInvites;
}
