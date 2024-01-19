import { HyperstructuresListItem } from "./HyperstructuresListItem";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useMemo, useState } from "react";
import { getRealm } from "../../../utils/realms";
import { useDojo } from "../../../DojoContext";
import { FeedHyperstructurePopup } from "./FeedHyperstructure";
import useUIStore from "../../../hooks/store/useUIStore";
import { LevelingBonusIcons } from "../../cityview/realm/leveling/Leveling";
import { LevelIndex } from "../../../hooks/helpers/useLevel";
import { ConqueredHyperstructures } from "./ConqueredHyperstructures";

type HyperstructuresListComponentProps = {
  showOnlyPlayerOrder?: boolean;
};

export const HyperstructuresListComponent = ({ showOnlyPlayerOrder = false }: HyperstructuresListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const hyperstructures = useUIStore((state) => state.hyperstructures);

  const {
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const chosenOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId)?.order : undefined),
    [account, realmEntityIds],
  );

  const bonusList = useMemo(() => {
    if (!hyperstructures) return [];
    const bonusAmount =
      hyperstructures.filter((struct) => {
        struct?.completed && struct.orderId === chosenOrder;
      }).length * 25;
    return [
      {
        bonusType: LevelIndex.FOOD,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.RESOURCE,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.TRAVEL,
        bonusAmount,
      },
      {
        bonusType: LevelIndex.COMBAT,
        bonusAmount,
      },
    ];
  }, [hyperstructures]);

  return (
    <>
      {chosenOrder && showFeedPopup && (
        <FeedHyperstructurePopup onClose={() => setShowFeedPopup(false)} order={chosenOrder} />
      )}
      {/* // todo: work on that to show summary of the conquests */}
      {/* <div className="flex flex-row w-full justify-between">
        {chosenOrder && <ConqueredHyperstructures className={"mt-2 relative mb-10 ml-4"} order={chosenOrder} />}
        <LevelingBonusIcons
          className="flex flex-row ml-4 mr-2 items-center justify-center -mt-4 !text-xxs"
          bonuses={bonusList}
          includeZero={true}
        ></LevelingBonusIcons>
        <div className="w-[30%] text-gold text-xxs">Some stats</div>
      </div> */}
      {!showOnlyPlayerOrder && (
        <div className="flex flex-col space-y-2 px-2 mb-2">
          {/* <div className="text-xs text-gold">Hyperstructures: </div> */}
          {[hyperstructures[0]].map((hyperstructure, i) => (
            <HyperstructuresListItem
              key={i}
              hyperstructure={hyperstructure}
              order={hyperstructure?.orderId || 0}
              coords={hyperstructure?.uiPosition as any}
              onFeed={() => {
                moveCameraToTarget(hyperstructures[i]?.uiPosition as any);
                setShowFeedPopup(true);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
