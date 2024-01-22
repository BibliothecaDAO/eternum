import { useMemo, useState } from "react";
import { FilterButton } from "../../../../elements/FilterButton";
import { FiltersPanel } from "../../../../elements/FiltersPanel";
import { Headline } from "../../../../elements/Headline";
import { SortButton, SortInterface } from "../../../../elements/SortButton";
import { SortPanel } from "../../../../elements/SortPanel";
import { EnnemyRaidersPanel } from "../../../cityview/realm/combat/defence/EnnemyRaidsPanel";
import { RaidsPanel } from "../../../cityview/realm/combat/raids/RaidsPanel";

export type HyperStructureRaidersPanelProps = {
  myRaidersIds: bigint[];
  enemyRaidersIds: bigint[];
};

export const HyperStructureRaidersPanel = ({ myRaidersIds, enemyRaidersIds }: HyperStructureRaidersPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);

  const sortingParams = useMemo(() => {
    return [
      { label: "Number", sortKey: "number" },
      { label: "Health-bar", sortKey: "health", className: "ml-4" },
      { label: "Items", sortKey: "items", className: "ml-auto mr-4" },
      { label: "Time-left", sortKey: "time", className: "" },
    ];
  }, []);
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  return (
    <div>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>
          Filter
        </FilterButton>
      </FiltersPanel>
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
      {myRaidersIds.length > 0 && <Headline className="mt-2">Your Raiders</Headline>}
      <RaidsPanel raiderIds={myRaidersIds} showCreateButton={false} className="h-max" />
      {enemyRaidersIds.length > 0 && <Headline className="">Other Raiders</Headline>}
      <EnnemyRaidersPanel raiderIds={enemyRaidersIds} />
    </div>
  );
};
