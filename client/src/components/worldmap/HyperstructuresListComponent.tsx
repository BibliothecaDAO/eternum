import { FiltersPanel } from "../../elements/FiltersPanel";
import { FilterButton } from "../../elements/FilterButton";
import { HYPERSTRUCTURES_POSITIONS } from "../../modules/scenes/WorldMapScene";
import { HyperstructuresListItem } from "./HyperstructuresListItem";
import useRealmStore from "../../hooks/store/useRealmStore";
import { useMemo } from "react";
import { getRealm } from "../../utils/realms";
import { useDojo } from "../../DojoContext";

type HyperstructuresListComponentProps = {};

export const HyperstructuresListComponent = ({}: HyperstructuresListComponentProps) => {
  const {
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : 1),
    [account, realmEntityIds],
  );

  return (
    <>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={false}>Filter</FilterButton>
      </FiltersPanel>
      <div className="space-y-2 px-2 mb-2">
        <div className="text-xs text-gold">Hyperstructure of your order: </div>
        <HyperstructuresListItem
          order={chosenOrder - 1}
          coords={HYPERSTRUCTURES_POSITIONS[chosenOrder - 1]}
          canBuild={true}
        />
      </div>
      <div className="flex flex-col space-y-2 px-2 mb-2">
        <div className="text-xs text-gold">Other Hyperstructures: </div>
        {HYPERSTRUCTURES_POSITIONS.map((hyperstructure, i) =>
          i + 1 !== chosenOrder ? (
            <HyperstructuresListItem key={i} order={i} coords={hyperstructure} canBuild={false} />
          ) : (
            <></>
          ),
        )}
      </div>
    </>
  );
};
