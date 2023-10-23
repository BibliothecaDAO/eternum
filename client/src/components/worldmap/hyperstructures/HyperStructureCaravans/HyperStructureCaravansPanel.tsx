import { useMemo, useState } from "react";
import { CaravanInterface } from "../../../../hooks/graphql/useGraphQLQueries";
import { SortButton, SortInterface } from "../../../../elements/SortButton";
import { FiltersPanel } from "../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../elements/FilterButton";
import { SortPanel } from "../../../../elements/SortPanel";
import { CaravanDetails } from "../../../caravans/CaravanDetailsComponent";
import { HyperStructureCaravan } from "./HyperStructureCaravan";
import { HyperStructureInterface } from "../../../../hooks/helpers/useHyperstructure";

type CaravansPanelProps = {
  caravans: CaravanInterface[];
  hyperstructureData: HyperStructureInterface;
};

export const HyperStructureCaravansPanel = ({ caravans, hyperstructureData }: CaravansPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showCaravanDetails, setShowCaravanDetails] = useState(false);
  const [selectedCaravan, setSelectedCaravan] = useState<CaravanInterface | null>(null);

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
    <div className="flex flex-col">
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
      {selectedCaravan && showCaravanDetails && (
        <CaravanDetails caravan={selectedCaravan} onClose={() => setShowCaravanDetails(false)} />
      )}
      {caravans && (
        <div className="flex flex-col p-2 space-y-2 max-h-[500px] overflow-auto">
          {caravans.map((caravan) => (
            <HyperStructureCaravan
              onClick={() => setSelectedCaravan(caravan)}
              key={caravan.caravanId}
              caravan={caravan}
              hyperstructureData={hyperstructureData}
            />
          ))}
        </div>
      )}
    </div>
  );
};
