import { FiltersPanel } from "../../../elements/FiltersPanel";
import { FilterButton } from "../../../elements/FilterButton";
import { HYPERSTRUCTURES_POSITIONS } from "../../../modules/scenes/WorldMapScene";
import { HyperstructuresListItem } from "./HyperstructuresListItem";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useMemo, useState } from "react";
import { getRealm } from "../../../utils/realms";
import { useDojo } from "../../../DojoContext";
import { FeedHyperstructurePopup } from "./FeedHyperstructure";
import useUIStore from "../../../hooks/store/useUIStore";
import { getContractPositionFromRealPosition } from "../../../utils/utils";

type HyperstructuresListComponentProps = {};

export const HyperstructuresListComponent = ({}: HyperstructuresListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);

  const {
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId).order : undefined),
    [account, realmEntityIds],
  );

  return (
    <>
      <FiltersPanel className="px-3 py-2">
        <FilterButton active={false}>Filter</FilterButton>
      </FiltersPanel>
      {chosenOrder && showFeedPopup && (
        <FeedHyperstructurePopup onClose={() => setShowFeedPopup(false)} order={chosenOrder} />
      )}
      {chosenOrder && (
        <div className="space-y-2 px-2 mb-2">
          <div className="text-xs text-gold">Hyperstructure of your order: </div>
          <HyperstructuresListItem
            order={chosenOrder}
            coords={HYPERSTRUCTURES_POSITIONS[chosenOrder - 1]}
            onFeed={() => {
              moveCameraToTarget(HYPERSTRUCTURES_POSITIONS[chosenOrder - 1]);
              setShowFeedPopup(true);
            }}
          />
        </div>
      )}
      <div className="flex flex-col space-y-2 px-2 mb-2">
        <div className="text-xs text-gold">Other Hyperstructures: </div>
        {HYPERSTRUCTURES_POSITIONS.map((hyperstructure, i) =>
          chosenOrder && i + 1 !== chosenOrder ? (
            <HyperstructuresListItem
              key={i}
              order={i + 1}
              coords={getContractPositionFromRealPosition({
                x: hyperstructure.x,
                y: hyperstructure.z,
              })}
            />
          ) : null,
        )}
      </div>
    </>
  );
};
