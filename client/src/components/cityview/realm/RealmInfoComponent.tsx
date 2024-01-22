import { OrderIcon } from "../../../elements/OrderIcon";
import useRealmStore from "../../../hooks/store/useRealmStore";
import realmsNames from "../../../geodata/realms.json";
import { Resource, getLevelingCost, orderNameDict } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useGetRealm } from "../../../hooks/helpers/useRealm";
import { useDojo } from "../../../DojoContext";
import { LevelingBonusIcons } from "./leveling/Leveling";
import { LaborAuction } from "./labor/LaborAuction";
import { LevelingPopup } from "./leveling/LevelingPopup";
import { useEffect, useMemo, useState } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { useLevel } from "../../../hooks/helpers/useLevel";
import { useLocation } from "wouter";
import { RealmLevel } from "../../../elements/RealmLevel";
import Button from "../../../elements/Button";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getComponentValue } from "@dojoengine/recs";
import { ConqueredHyperstructures } from "../../worldmap/hyperstructures/ConqueredHyperstructures";

type RealmInfoComponentProps = {};

const bgColorsByOrder = {
  power: "#6D4C11",
  anger: "#4F0916",
  brilliance: "#287F4A",
  detection: "#0B3D1F",
  enlightenment: "#063658",
  fox: "#612C0F",
  fury: "#490626",
  giants: "#6D4C11",
  perfection: "#310B4F",
  reflection: "#124A4A",
  skill: "#11105F",
  titans: "#5C1437",
  twins: "#060E39",
  vitriol: "#273F0F",
  rage: "#61290A",
  protection: "#0E543F",
};

export const RealmInfoComponent = ({}: RealmInfoComponentProps) => {
  const {
    account: { accountDisplay },
    setup: {
      components: { Resource },
    },
  } = useDojo();
  const [_location, setLocation] = useLocation();
  const [levelUpProgress, setLevelUpProgress] = useState(0);

  const [showRealmLevelUp, setShowRealmLevelUp] = useState(false);
  const setTooltip = useUIStore((state) => state.setTooltip);
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const { getRealmBonuses, getEntityLevel } = useLevel();

  const realmLevel = realmEntityId ? getEntityLevel(realmEntityId) : undefined;

  const realmBonuses = useMemo(() => {
    const bonus = realmLevel ? getRealmBonuses(realmLevel.level) : [];
    return bonus.reduce((acc, curr) => acc + curr.bonusAmount, 0) === 0 ? undefined : bonus;
  }, [realmLevel]);

  const showOnMap = () => {
    setLocation("/map");
    setIsLoadingScreenEnabled(true);
    moveCameraToWorldMapView();
    setTimeout(() => {
      moveCameraToRealm(Number(realm?.realmId));
    }, 300);
  };

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources = useMemo(() => {
    if (realmLevel) {
      return getLevelingCost(realmLevel.level + 1);
    } else return [];
  }, [realmLevel]);

  useEffect(() => {
    let missingResources: Resource[] = [];
    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );

      if (!realmResource || realmResource.balance < amount) {
        missingResources.push({ resourceId, amount: amount - (Number(realmResource?.balance) || 0) });
      }
    });
    setLevelUpProgress(Math.round(((costResources.length - missingResources.length) / costResources.length) * 100));
  }, [costResources]);

  const canLevelUp = useMemo(() => {
    return levelUpProgress === 100;
  }, [levelUpProgress]);

  return (
    <>
      {realm && (
        <div
          className={clsx(
            "relative rounded-t-xl transition-colors duration-300 text-sm flex items-center pt-3 px-3 text-white justify-between ",
          )}
        >
          <div className="flex flex-col leading-4">
            <div className="flex">
              <div className="text-xxs leading-none mr-2 text-gold">{accountDisplay}</div>
            </div>
            <div className="leading-none font-bold text-lg flex items-center">
              <div
                className=" flex items-center justify-center rounded-full p-0.5 mr-1"
                style={{
                  backgroundColor: bgColorsByOrder[orderNameDict[realm?.order] as keyof typeof bgColorsByOrder],
                }}
              >
                <OrderIcon order={orderNameDict[realm?.order]} size="xxs" />
              </div>
              {realmsNames.features[Number(realm.realmId) - 1].name}
              <RealmLevel
                onMouseEnter={() => {
                  if (!realmBonuses) return;
                  setTooltip({
                    position: "top",
                    content: (
                      <>{<LevelingBonusIcons className="flex flex-row" bonuses={realmBonuses}></LevelingBonusIcons>}</>
                    ),
                  });
                }}
                onMouseLeave={() => {
                  setTooltip(null);
                }}
                className="ml-2"
                level={realmLevel?.level as number}
              />
            </div>
          </div>
          <LaborAuction className="!absolute top-2 right-2 !-mt-1" />
          {showRealmLevelUp && <LevelingPopup onClose={() => setShowRealmLevelUp(false)}></LevelingPopup>}
          <ConqueredHyperstructures className={"text-xxs absolute top-2 right-2 -mt-1"} order={realm.order} />
        </div>
      )}
      <div className="flex space-x-2 mt-1 items-center px-4">
        <div
          className={clsx(
            "relative rounded-md bg-dark-green-accent text-xs text-order-brilliance px-2 py-1 hover:opacity-70 opacity-100 !transition-all",
            canLevelUp && "text-transparent bg-transparent",
          )}
          onClick={() => setShowRealmLevelUp(true)}
          onMouseEnter={() =>
            setTooltip({
              position: "top",
              content: (
                <>
                  <p>Upgrade your Realm to unlock</p>
                  <p>new features and get buffs.</p>
                </>
              ),
            })
          }
          onMouseLeave={() => setTooltip(null)}
        >
          Level UP
          <Button
            onClick={() => {}}
            isPulsing={canLevelUp}
            className={clsx(
              "!p-0 !bg-order-brilliance box-content !text-brown absolute left-0 top-0 bottom-0 text-right overflow-hidden",
              canLevelUp && "border border-[#1C2313]",
            )}
            style={{
              width: `${levelUpProgress}%`,
            }}
          >
            <div className="absolute left-2 top-1/2 -translate-y-1/2">Level UP</div>
          </Button>
        </div>

        <Button variant="primary" onClick={showOnMap}>
          Show on Map
        </Button>
      </div>
    </>
  );
};

export default RealmInfoComponent;
