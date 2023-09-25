import { FiltersPanel } from "../../elements/FiltersPanel";
import { FilterButton } from "../../elements/FilterButton";
import { HYPERSTRUCTURES_POSITIONS } from "../../modules/scenes/WorldMapScene";
import { HyperstructuresListItem } from "./HyperstructuresListItem";

type HyperstructuresListComponentProps = {};

export const HyperstructuresListComponent = ({}: HyperstructuresListComponentProps) => {
  return (
    <>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={false}>Filter</FilterButton>
      </FiltersPanel>
      <div className="flex flex-col space-y-2 px-2 mb-2">
        {HYPERSTRUCTURES_POSITIONS.map((hyperstructure, i) => (
          <HyperstructuresListItem key={i} order={i} coords={hyperstructure} />
        ))}
      </div>
    </>
  );
};
