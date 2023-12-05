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

  const [showRealmLevelUp, setShowRealmLevelUp] = useState(false);
  const [_, setShowHyperstructureLevelUp] = useState(false);
  // const [showHyperstructureLevelUp, setShowHyperstructureLevelUp] = useState(false);

  const setTooltip = useUIStore((state) => state.setTooltip);

  const { getAddressName } = useRealm();
  const addressName = getAddressName(account.address);

  const { realmEntityId } = useRealmStore();
  const { realm } = useGetRealm(realmEntityId);

  const { getHyperstructureIdByRealmEntityId } = useHyperstructure();
  const { getHyperstructureBonuses, getRealmBonuses, getEntityLevel } = useLevel();

  const hyperstructureId = realmEntityId ? getHyperstructureIdByRealmEntityId(realmEntityId) : undefined;

  const hyperstructureLevel = getEntityLevel(hyperstructureId);
  const realmLevel = getEntityLevel(realmEntityId);

  const hyperstructureBonuses = useMemo(() => {
    const bonus = getHyperstructureBonuses(hyperstructureLevel.level);
    return bonus.reduce((acc, curr) => acc + curr.bonusAmount, 0) === 0 ? undefined : bonus;
  }, [hyperstructureLevel]);

  const realmBonuses = useMemo(() => {
    const bonus = getRealmBonuses(hyperstructureLevel.level);
    return bonus.reduce((acc, curr) => acc + curr.bonusAmount, 0) === 0 ? undefined : bonus;
  }, [realmLevel]);

  return (
    <>
      {realm && (
        <div
          className={clsx(
            "relative rounded-t-xl transition-colors duration-300 text-sm shadow-lg shadow-black/25 flex items-center px-4 py-2 text-white h-[50px] justify-between ",
          )}
          style={{
            backgroundColor: bgColorsByOrder[orderNameDict[realm?.order] as keyof typeof bgColorsByOrder],
          }}
        >
          <div className="flex flex-col leading-4">
            <div className="flex">
              <div className="text-xxs mr-2">{accountDisplay}</div>
              <div className="text-xxs">{addressName}</div>
            </div>
            <div className="font-bold">{realmsNames.features[realm.realmId - 1].name}</div>
          </div>
          <LaborAuction />
          <div
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
            className="cursor-pointer"
          >
            <div className="text-xxs"> Realm </div>
            {showRealmLevelUp && <LevelingPopup onClose={() => setShowRealmLevelUp(false)}></LevelingPopup>}
            <Leveling setShowLevelUp={setShowRealmLevelUp} entityId={realmEntityId} />
          </div>
          {/* <div className="cursor-pointer"> */}
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
            {/* todo: add hyperstructure level up */}
            <div className="text-xxs"> Order </div>
            {/* {showHyperstructureLevelUp && (
              <LevelingPopup onClose={() => setShowHyperstructureLevelUp(false)}></LevelingPopup>
            )} */}
            <Leveling setShowLevelUp={setShowHyperstructureLevelUp} entityId={hyperstructureId} />
          </div>
          <div className="flex items-center capitalize">
            <OrderIcon order={orderNameDict[realm?.order]} size="xs" />
          </div>
        </div>
      )}
    </>
  );
};

export default RealmInfoComponent;
