import { useMemo, useState } from "react";
import { FiltersPanel } from "../../../../../elements/FiltersPanel";
import { FilterButton } from "../../../../../elements/FilterButton";
import { SortPanel } from "../../../../../elements/SortPanel";
import { SortButton, SortInterface } from "../../../../../elements/SortButton";
import { Caravan } from "./Caravan";
import { CaravanDetails } from "../../../../caravans/CaravanDetailsComponent";
import { CaravanInterface } from "../../../../../hooks/graphql/useGraphQLQueries";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import useBlockchainStore from "../../../../../hooks/store/useBlockchainStore";
import { useGetPositionCaravans } from "../../../../../hooks/helpers/useCaravans";
import { getPosition } from "../../../../../utils/utils";

type CaravansPanelProps = {};

export const CaravansPanel = ({}: CaravansPanelProps) => {
  const [activeFilter, setActiveFilter] = useState(false);
  const [showCaravanDetails, setShowCaravanDetails] = useState(false);
  const [selectedCaravan, setSelectedCaravan] = useState<CaravanInterface | null>(null);

  const realmId = useRealmStore((state) => state.realmId);
  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const onClick = (caravan: CaravanInterface) => {
    // way to find if caravan has currently resources inside
    if (caravan?.arrivalTime && nextBlockTimestamp && caravan.arrivalTime > nextBlockTimestamp) {
      setShowCaravanDetails(true);
    } else {
    }
    setSelectedCaravan(caravan);
  };

  const realmPosition = useMemo(() => {
    return realmId ? getPosition(realmId) : undefined;
  }, [realmId]);
  const { caravans: realmCaravans } = useGetPositionCaravans(realmPosition?.x || 0, realmPosition?.y || 0);

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
      {realmCaravans && (
        <div className="flex flex-col p-2 space-y-2">
          {realmCaravans.map((caravan) => (
            <Caravan key={caravan.caravanId} caravan={caravan} onClick={() => onClick(caravan)} />
          ))}
        </div>
      )}
    </div>
  );
};
