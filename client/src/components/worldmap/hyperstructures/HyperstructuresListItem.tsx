import { OrderIcon } from "../../../elements/OrderIcon";
import Button from "../../../elements/Button";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { orderNameDict, orders } from "@bibliothecadao/eternum";
import useUIStore from "../../../hooks/store/useUIStore";
import ProgressBar from "../../../elements/ProgressBar";
import { HyperStructureInterface, useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import clsx from "clsx";
import { UIPosition } from "../../../types";
import { Leveling, LevelingBonusIcons } from "../../cityview/realm/leveling/Leveling";
import { useMemo, useState } from "react";
import { LevelIndex, useLevel } from "../../../hooks/helpers/useLevel";
import { useDojo } from "../../../DojoContext";

type HyperstructuresListItemProps = {
  hyperstructure: HyperStructureInterface | undefined;
  order: number;
  coords: UIPosition | undefined;
  onFeed?: () => void;
};

export const HyperstructuresListItem = ({
  hyperstructure,
  order,
  coords,
  onFeed = undefined,
}: HyperstructuresListItemProps) => {
  const {
    account: { account },
    setup: {
      systemCalls: { level_up_hyperstructure },
    },
  } = useDojo();

  const hyperstructures = useUIStore((state) => state.hyperstructures);
  const setHyperstructures = useUIStore((state) => state.setHyperstructures);
  const { getHyperstructure } = useHyperstructure();

  const moveCameraToTarget = useUIStore((state) => state.moveCameraToTarget);
  const [isLoading, setIsLoading] = useState(false);

  const { getHyperstructureLevelBonus } = useLevel();

  const updateHyperStructure = () => {
    if (!hyperstructure) return;
    const newHyperstructure = getHyperstructure(hyperstructure.orderId, hyperstructure.uiPosition);
    hyperstructures[hyperstructure.orderId - 1] = newHyperstructure;
    setHyperstructures([...hyperstructures]);
  };

  const canLevelUp = hyperstructure?.progress === 100;

  const onLevelUp = async () => {
    setIsLoading(true);
    if (!hyperstructure) return;
    await level_up_hyperstructure({
      signer: account,
      hyperstructure_id: hyperstructure.hyperstructureId,
    });
    updateHyperStructure();
    setIsLoading(false);
  };

  const bonusList = useMemo(() => {
    if (!hyperstructure) return [];
    return [
      {
        bonusType: LevelIndex.FOOD,
        bonusAmount: getHyperstructureLevelBonus(hyperstructure.level, LevelIndex.FOOD) - 100,
      },
      {
        bonusType: LevelIndex.RESOURCE,
        bonusAmount: getHyperstructureLevelBonus(hyperstructure.level, LevelIndex.RESOURCE) - 100,
      },
      {
        bonusType: LevelIndex.TRAVEL,
        bonusAmount: getHyperstructureLevelBonus(hyperstructure.level, LevelIndex.TRAVEL) - 100,
      },
      {
        bonusType: LevelIndex.COMBAT,
        bonusAmount: getHyperstructureLevelBonus(hyperstructure.level, LevelIndex.COMBAT) - 100,
      },
    ];
  }, [hyperstructure]);

  return (
    <div className="flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold">
      <div className="flex items-center">
        <div className="flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold">
          {<OrderIcon order={orderNameDict[order]} size="xs" className="mr-1" />}
          {orders[order - 1].fullOrderName}
        </div>
        <div className=" text-gold flex ml-auto">
          <LevelingBonusIcons
            className="flex flex-row mr-2 items-center justify-center !text-xxs"
            bonuses={bonusList}
          ></LevelingBonusIcons>
          <Button
            onClick={() => {
              moveCameraToTarget(coords as any);
            }}
            variant="outline"
            className="p-1 !h-4 text-xxs !rounded-md"
          >
            <Map className="mr-1 fill-current" />
            Show on map
          </Button>
        </div>
      </div>
      <Leveling setShowLevelUp={() => {}} className={"mt-2"} entityId={hyperstructure?.hyperstructureId} />
      <div className="flex flex-col w-full mt-3">
        <div className="text-white mb-1">Next Level</div>
        <ProgressBar rounded progress={hyperstructure?.progress || 0} className="bg-white" />
        <div className="flex items-center mt-2">
          <div
            className={clsx(
              "ml-1 italic ",
              hyperstructure?.completed && "text-order-brilliance",
              hyperstructure && hyperstructure?.progress >= 0 && !hyperstructure?.completed ? "text-gold" : "",
            )}
          >
            {hyperstructure?.completed ? "Completed" : `Building in progress ${hyperstructure?.progress.toFixed(2)}%`}
          </div>

          <div className="text-xxs ml-auto">
            {onFeed && (
              <Button
                isLoading={isLoading}
                disabled={!canLevelUp}
                className="!px-[6px] !py-[2px] mr-2"
                variant="success"
                onClick={onLevelUp}
              >
                Level Up
              </Button>
            )}
            {onFeed && (
              <Button
                disabled={hyperstructure?.completed || canLevelUp}
                className="!px-[6px] !py-[2px]"
                variant="outline"
                onClick={onFeed}
              >
                Manage
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
