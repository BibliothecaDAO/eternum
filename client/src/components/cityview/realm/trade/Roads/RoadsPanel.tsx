import React, { useMemo, useState } from "react";
import { Road } from "./Road";
import { RoadBuildPopup } from "./RoadBuildPopup";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useGetRoads } from "../../../../../hooks/helpers/useRoads";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { FilterButton } from "../../../../../elements/FilterButton";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";

type RoadsPanelProps = {} & React.HTMLAttributes<HTMLDivElement>;

// @ts-ignore
export const RoadsPanel = (props: RoadsPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [activeSort, setActiveSort] = useState<SortInterface>({
    sortKey: "number",
    sort: "none",
  });

  const [buildRoadToEntityId, setBuildRoadToEntityId] = useState<number | undefined>(undefined);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  const { roads } = useGetRoads(realmEntityId);

  const sortingParams = useMemo(() => {
    return [
      { label: "Realm", sortKey: "realm" },
      { label: "Usage Left", sortKey: "usage", className: "" },
    ];
  }, []);

  return (
    <>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={activeFilter} onClick={() => setActiveFilter(!activeFilter)}>
          Filter
        </FilterButton>
      </FiltersPanel>
      <SortPanel className="flex justify-between px-3 py-2">
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
      {buildRoadToEntityId && (
        <RoadBuildPopup onClose={() => setBuildRoadToEntityId(undefined)} toEntityId={buildRoadToEntityId} />
      )}
      <div className="flex flex-col p-2 space-y-2 relative">
        {roads.map((road) => (
          <Road road={road} onAddUsage={() => setBuildRoadToEntityId(road.destinationEntityId)} />
        ))}
      </div>
    </>
  );
};
