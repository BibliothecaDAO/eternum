import { HyperstructuresListItem } from "./HyperstructuresListItem";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useEffect, useMemo, useState } from "react";
// import { getRealm } from "../../../utils/realms";
import { useDojo } from "../../../DojoContext";
import { FeedHyperstructurePopup } from "./FeedHyperstructure";
import useUIStore from "../../../hooks/store/useUIStore";
// import { LevelIndex } from "../../../hooks/helpers/useLevel";
import { HyperStructureInterface } from "@bibliothecadao/eternum";
import { getRealm } from "../../../utils/realms";

type HyperstructuresListComponentProps = {
  showOnlyPlayerOrder?: boolean;
};

export const HyperstructuresListComponent = ({ showOnlyPlayerOrder = false }: HyperstructuresListComponentProps) => {
  const [showFeedPopup, setShowFeedPopup] = useState(false);
  const [selectedHyperstructure, setSelectedHyperstructure] = useState<HyperStructureInterface | undefined>(undefined);
  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const hyperstructures = useUIStore((state) => state.hyperstructures);

  const {
    account: { account },
  } = useDojo();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const playerOrder = useMemo(
    () => (realmEntityIds.length > 0 ? getRealm(realmEntityIds[0].realmId)?.order : undefined),
    [account, realmEntityIds],
  );

  // const bonusList = useMemo(() => {
  //   if (!hyperstructures) return [];
  //   const bonusAmount =
  //     hyperstructures.filter((struct) => {
  //       struct?.completed && struct.orderId === chosenOrder;
  //     }).length * 25;
  //   return [
  //     {
  //       bonusType: LevelIndex.FOOD,
  //       bonusAmount,
  //     },
  //     {
  //       bonusType: LevelIndex.RESOURCE,
  //       bonusAmount,
  //     },
  //     {
  //       bonusType: LevelIndex.TRAVEL,
  //       bonusAmount,
  //     },
  //     {
  //       bonusType: LevelIndex.COMBAT,
  //       bonusAmount,
  //     },
  //   ];
  // }, [hyperstructures]);

  return (
    <>
      {showFeedPopup && selectedHyperstructure && (
        <FeedHyperstructurePopup
          selectedHyperstructure={selectedHyperstructure}
          onClose={() => setShowFeedPopup(false)}
        />
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
          {hyperstructures.map((hyperstructure, i) => (
            <HyperstructuresListItem
              key={i}
              hyperstructure={hyperstructure}
              playerOrder={playerOrder || 0}
              coords={hyperstructure?.uiPosition as any}
              onFeed={() => {
                moveCameraToTarget(hyperstructures[i]?.uiPosition as any);
                setSelectedHyperstructure(hyperstructure);
                setShowFeedPopup(true);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};
