import { RESOURCE_TIERS, ResourcesIds, findResourceById, getIconResourceId, resources } from "@bibliothecadao/eternum";
import { useDojo } from "../../../hooks/context/DojoContext";
import useRealmStore from "../../../hooks/store/useRealmStore";
import useUIStore from "../../../hooks/store/useUIStore";
import useBlockchainStore from "../../../hooks/store/useBlockchainStore";
import { ResourceIcon } from "../../elements/ResourceIcon";
import { currencyFormat } from "../../utils/utils";

export const EntityResourceTable = () => {
  return (
    <div>
      {/* {resources.map((resource) => (
        <ResourceComponent className="mr-3 mb-1" canFarm={true} key={resource.id} resourceId={resource.id} />
      ))} */}

      {Object.entries(RESOURCE_TIERS).map(([tier, resourceIds]) => (
        <div className="my-3 px-3" key={tier}>
          <h4>Tier: {tier}</h4>
          <hr />
          <div className="flex my-3 flex-wrap">
            {resourceIds.map((resourceId) => (
              <ResourceComponent className="mr-3 mb-1" canFarm={true} key={resourceId} resourceId={resourceId} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const ResourceComponent = ({
  isLabor = false,
  resourceId,
  className,
  canFarm = true,
}: {
  isLabor?: boolean;
  resourceId: number;
  canFarm?: boolean;
  className?: string;
}) => {
  const {
    setup: {
      components: { Labor, Resource },
    },
  } = useDojo();

  let { realmEntityId } = useRealmStore();
  const setTooltip = useUIStore((state) => state.setTooltip);
  const conqueredHyperstructureNumber = useUIStore((state) => state.conqueredHyperstructureNumber);

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  // const [productivity, setProductivity] = useState<number>(0);

  // const { getEntityLevel, getRealmLevelBonus } = useLevel();

  // const isFood = useMemo(() => [254, 255].includes(resourceId), [resourceId]);

  // const level = getEntityLevel(realmEntityId)?.level || 0;
  // // get harvest bonuses
  // const [levelBonus, hyperstructureLevelBonus] = useMemo(() => {
  //   const levelBonus = getRealmLevelBonus(level, isFood ? LevelIndex.FOOD : LevelIndex.RESOURCE);
  //   return [levelBonus, conqueredHyperstructureNumber * 25 + 100];
  // }, [realmEntityId, isFood]);

  // const labor = useComponentValue(Labor, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  // const resource = useComponentValue(Resource, getEntityIdFromKeys([BigInt(realmEntityId ?? 0), BigInt(resourceId)]));

  // useEffect(() => {
  //   let laborLeft: number = 0;
  //   if (nextBlockTimestamp && labor && labor.balance > nextBlockTimestamp) {
  //     laborLeft = labor.balance - nextBlockTimestamp;
  //   }
  //   const productivity =
  //     // can have a small difference between block timestamp and actual block so make sure that laborLeft is more than 1 minute
  //     labor && laborLeft > 60
  //       ? calculateProductivity(
  //           isFood ? LABOR_CONFIG.base_food_per_cycle : LABOR_CONFIG.base_resources_per_cycle,
  //           labor.multiplier,
  //           LABOR_CONFIG.base_labor_units,
  //           levelBonus,
  //           hyperstructureLevelBonus,
  //         )
  //       : 0;
  //   setProductivity(productivity);
  // }, [nextBlockTimestamp, labor]);

  return (
    <div className={`flex relative group items-center text-sm border rounded px-2 p-1`}>
      <ResourceIcon
        isLabor={isLabor}
        withTooltip={false}
        resource={findResourceById(getIconResourceId(resourceId, isLabor))?.trait as string}
        size="md"
        className="mr-1"
      />
      <div className="flex space-x-3 items-center justify-center">
        <div className="font-bold">{findResourceById(resourceId)?.trait}</div>
        <div>9999</div>
        {/* <div>{currencyFormat(resource ? Number(resource.balance) : 0, 2)}</div> */}
      </div>
      {/* <div className="flex text-xs">
          {currencyIntlFormat(
            resource ? (!isLabor ? divideByPrecision(Number(resource.balance)) : Number(resource.balance)) : 0,
            2,
          )}
          {resourceId !== 253 && canFarm && (
            <div
              className={clsx(
                "text-xxs ml-1 rounded-[5px] px-1 w-min ",
                productivity > 0 && "text-order-vitriol bg-dark-green",
                (productivity === 0 || productivity === undefined) && "text-gold bg-brown",
              )}
            >
              {productivity === 0 || productivity === undefined
                ? "IDLE"
                : `${divideByPrecision(productivity).toFixed(0)}/h`}
            </div>
          )}
        </div> */}
    </div>
  );
};
