import { OrderIcon } from "../../../elements/OrderIcon";
import useRealmStore from "../../../hooks/store/useRealmStore";
import realmsNames from "../../../geodata/realms.json";
import { orderNameDict } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useGetRealm, useRealm } from "../../../hooks/helpers/useRealm";
import { useDojo } from "../../../DojoContext";
import { Leveling, LevelingBonusIcons } from "./leveling/Leveling";
import { LaborAuction } from "./labor/LaborAuction";
import { useHyperstructure } from "../../../hooks/helpers/useHyperstructure";
import { LevelingPopup } from "./leveling/LevelingPopup";
import { useMemo, useState } from "react";
import useUIStore from "../../../hooks/store/useUIStore";
import { useLevel } from "../../../hooks/helpers/useLevel";
import { ReactComponent as Map } from "../../../assets/icons/common/map.svg";
import { useLocation } from "wouter";
import { RealmLevel } from "../../../elements/RealmLevel";
import Button from "../../../elements/Button";
import { set } from "mobx";

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
    account: { accountDisplay, account },
  } = useDojo();
  const [_location, setLocation] = useLocation();

  const [showRealmLevelUp, setShowRealmLevelUp] = useState(false);
  const [_, setShowHyperstructureLevelUp] = useState(false);
  // const [showHyperstructureLevelUp, setShowHyperstructureLevelUp] = useState(false);

  const setTooltip = useUIStore((state) => state.setTooltip);
  const moveCameraToRealm = useUIStore((state) => state.moveCameraToRealm);
  const moveCameraToWorldMapView = useUIStore((state) => state.moveCameraToWorldMapView);
  const setIsLoadingScreenEnabled = useUIStore((state) => state.setIsLoadingScreenEnabled);

  const { getAddressName } = useRealm();
  const addressName = getAddressName(account.address);

  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const { getHyperstructureIdByRealmEntityId } = useHyperstructure();
  const { getHyperstructureBonuses, getRealmBonuses, getEntityLevel } = useLevel();

  const hyperstructureId = realmEntityId ? getHyperstructureIdByRealmEntityId(realmEntityId) : undefined;

  const hyperstructureLevel = hyperstructureId ? getEntityLevel(hyperstructureId) : undefined;
  const realmLevel = realmEntityId ? getEntityLevel(realmEntityId) : undefined;

  const hyperstructureBonuses = useMemo(() => {
    const bonus = hyperstructureLevel ? getHyperstructureBonuses(hyperstructureLevel?.level) : [];
    return bonus.reduce((acc, curr) => acc + curr.bonusAmount, 0) === 0 ? undefined : bonus;
  }, [hyperstructureLevel]);

  const realmBonuses = useMemo(() => {
    const bonus = realmLevel ? getRealmBonuses(realmLevel.level) : [];
    return bonus.reduce((acc, curr) => acc + curr.bonusAmount, 0) === 0 ? undefined : bonus;
  }, [realmLevel]);

  const showOnMap = () => {
    setLocation("/map");
    setIsLoadingScreenEnabled(true);
    moveCameraToWorldMapView();
    setTimeout(() => {
      moveCameraToRealm(realm?.realmId as number);
    }, 300);
  };

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
              {realmsNames.features[realm.realmId - 1].name}
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
          <LaborAuction />
          {showRealmLevelUp && <LevelingPopup onClose={() => setShowRealmLevelUp(false)}></LevelingPopup>}
          <div
            onMouseEnter={() => {
              if (!hyperstructureBonuses) return;
              setTooltip({
                position: "top",
                content: (
                  <>
                    {
                      <LevelingBonusIcons
                        className={"flex flex-row"}
                        bonuses={hyperstructureBonuses}
                      ></LevelingBonusIcons>
                    }
                  </>
                ),
              });
            }}
            onMouseLeave={() => {
              setTooltip(null);
            }}
            className="cursor-pointer"
          >
            {/* {showHyperstructureLevelUp && (
              <LevelingPopup onClose={() => setShowHyperstructureLevelUp(false)}></LevelingPopup>
            )} */}
            <Leveling
              className={"text-xxs"}
              setShowLevelUp={setShowHyperstructureLevelUp}
              entityId={hyperstructureId}
            />
          </div>
        </div>
      )}
      <div className="flex space-x-2 mt-1 items-center px-4">
        <Button
          onClick={() => setShowRealmLevelUp(true)}
          className="p-2 !py-1 !bg-order-brilliance border-0 !text-brown"
        >
          Level UP
        </Button>
        <Button variant="primary" onClick={showOnMap}>
          Show on Map
        </Button>
      </div>
    </>
  );
};

export default RealmInfoComponent;
