import { useMemo, useState } from "react";
import { SortButton, SortInterface } from "../../../elements/SortButton";
import { SortPanel } from "../../../elements/SortPanel";
import { GuildMemberAndName } from "../../../../hooks/helpers/useGuilds";

interface GuildMembersProps {
  guildMembers: GuildMemberAndName[];
}

export const GuildMembers = ({ guildMembers }: GuildMembersProps) => {
  const sortingParams = useMemo(() => {
    return [{ label: "Player", sortKey: "name", className: "w-1/6" }];
  }, []);

  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const copyPlayerAddressToClipboard = (member: GuildMemberAndName) => {
    navigator.clipboard
      .writeText(member.address.toString())
      .then(() => {
        alert(`Address of ${member.name} copied to clipboard`);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  };

  return (
    <>
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
        {sortGuildMembers(guildMembers, activeSort)?.map((member: GuildMemberAndName) => {
          return (
            <div key={member.address} className="flex px-3 text-xs hover:text-white">
              <p onClick={() => copyPlayerAddressToClipboard(member)}>{member.name}</p>
            </div>
          );
        })}
      </div>
    </>
  );
};

export function sortGuildMembers(
  guildMembers: GuildMemberAndName[],
  activeSort: SortInterface,
): GuildMemberAndName[] | undefined {
  const sortedGuildMembers = [...guildMembers];

  if (activeSort.sort === "none") return sortedGuildMembers;
  if (activeSort.sortKey === "name") {
    return sortedGuildMembers.sort((a, b) => {
      return activeSort.sort === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }
}
