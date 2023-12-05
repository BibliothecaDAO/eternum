import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../utils/utils";
import { getLevelingCost } from "./utils";
import useUIStore from "../../../../hooks/store/useUIStore";
import { LevelIndex, useLevel } from "../../../../hooks/helpers/useLevel";

type LevelingPopupProps = {
  onClose: () => void;
};

export const LevelingPopup = ({ onClose }: LevelingPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { level_up_realm },
    },
    account: { account },
  } = useDojo();

  let { realmEntityId } = useRealmStore();

  const { getEntityLevel, getRealmLevelBonus } = useLevel();

  const [level, tier] = useMemo(() => {
    let level = getEntityLevel(realmEntityId)?.level || 0;
    return [level, Math.floor(level / 4) + 1];
  }, [realmEntityId]);

  const bonusData = useMemo(() => {
    const foodProdBonus = getRealmLevelBonus(level, LevelIndex.FOOD);
    const resourceProdBonus = getRealmLevelBonus(level, LevelIndex.RESOURCE);
    const travelSpeedBonus = getRealmLevelBonus(level, LevelIndex.TRAVEL);
    const combatBonus = getRealmLevelBonus(level, LevelIndex.COMBAT);
    return [foodProdBonus, resourceProdBonus, travelSpeedBonus, combatBonus];
  }, [level]);

  const [canBuild, setCanBuild] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [newLevel, newIndex, newBonus] = useMemo(() => {
    // don't update if click on level_up
    const newLevel = level + 1;
    let newIndex = newLevel % 4;
    if (newIndex === 0) newIndex = 4;

    let newBonus = getRealmLevelBonus(newLevel, newIndex);
    return [newLevel, newIndex, newBonus];
  }, [level]);

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources = useMemo(() => {
    return getLevelingCost(newLevel);
  }, [realmEntityId, newLevel]);

  const onBuild = async () => {
    if (realmEntityId) {
      setIsLoading(true);
      await level_up_realm({ realm_entity_id: realmEntityId, signer: account });
      onClose();
    }
  };

  useEffect(() => {
    let canBuild = true;
    costResources.forEach(({ resourceId, amount }) => {
      const realmResource = getComponentValue(
        Resource,
        getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]),
      );

      if (!realmResource || realmResource.balance < amount) {
        canBuild = false;
      }
    });
    setCanBuild(canBuild);
  }, []);

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Level up:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"500px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Level Realm to {newLevel}</Headline>
          <div className={"relative w-full mt-3"}>
            <img
              src={`/images/levels/tier${tier.toString()}.png`}
              className="object-cover w-full h-full rounded-[10px]"
            />
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
              <div className="grid grid-cols-4 gap-2">
                {costResources.map(({ resourceId, amount }) => (
                  <ResourceCost
                    key={resourceId}
                    type="vertical"
                    resourceId={resourceId}
                    amount={divideByPrecision(amount)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-between m-2 text-xxs">
          <div className="w-full flex flex-col items-center justify-center">
            <div className="w-[90%] mb-3">
              {newLevel >= 5 && <Table updateLevel={{ newBonus, index: newIndex }} data={bonusData}></Table>}
              {newLevel < 5 && <UnlockMessage newLevel={newLevel}></UnlockMessage>}
            </div>
            <div className="flex">
              <Button
                className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                onClick={onClose}
                variant="outline"
                withoutSound
              >
                {`Cancel`}
              </Button>

              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                disabled={!canBuild}
                isLoading={isLoading}
                onClick={onBuild}
                variant="outline"
                withoutSound
              >
                {`Level Up`}
              </Button>
            </div>
            {!canBuild && <div className="text-xxs text-order-giants/70">Insufficient resources</div>}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

interface TableProps {
  // Define any props for your table here
  data: any[]; // Example prop for data
  updateLevel: { newBonus: number; index: number };
}

const Table: React.FC<TableProps> = ({ data, updateLevel }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  const elements = data.map((item, index) => {
    return index + 1 !== updateLevel.index ? (
      <td className="text-center py-2">{`+${Math.round(item) - 100}%`}</td>
    ) : (
      <td className="text-center py-2 flex flex-cols justify-center">
        <div>{`+${Math.round(item) - 100}%`}</div>
        <div className="mx-1 text-xxs">{"➜"}</div>
        <div className="text-order-brilliance">{`+${Math.round(updateLevel.newBonus - 100)}%`}</div>
      </td>
    );
  });

  return (
    <div className="overflow-x-auto text-gold border border-b border-gold rounded-xl">
      <table className="min-w-full text-gold">
        <thead className="border-b rounded-xl">
          <tr>
            {/* Add your table headers here */}
            <th
              className="text-center py-2 px-2 uppercase text-xs rounded-tl-lg"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Increase food production</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              Food
            </th>
            <th
              className="text-center py-2 px-2 uppercase text-xs"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Increase mines production</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              Mines
            </th>
            <th
              className="text-center py-2 px-2 uppercase text-xs"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Increase travel speed</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              Travel
            </th>
            <th
              className="text-center py-2 px-2 uppercase text-xs rounded-tr-lg"
              onMouseEnter={() =>
                setTooltip({
                  position: "top",
                  content: (
                    <>
                      <p className="whitespace-nowrap">Increase combat abilities</p>
                    </>
                  ),
                })
              }
              onMouseLeave={() => {
                setTooltip(null);
              }}
            >
              Combat
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Map through your data and create table rows */}
          <tr className="text-gold">{elements}</tr>
        </tbody>
      </table>
    </div>
  );
};

interface UnlockMessageProps {
  newLevel: number;
}

const UnlockMessage: React.FC<UnlockMessageProps> = ({ newLevel }) => {
  let title = "";
  let message = "";
  if (newLevel === 1) {
    title = "Unlock Mines Production and Trading";
    message =
      "Mines will allow you to produce the resources present on your realm like Coal and Wood. You can then start trading these resources with other realms.";
  } else if (newLevel === 2) {
    title = "Unlocking Banks";
    message =
      "Banks are a key component of the world. You can send food there using caravans and swap it against LORDS following a VRGDA curve. The more food is swapped, the less LORDS you get for the same amount.";
  } else if (newLevel === 3) {
    title = "Unlocking Hyperstructures";
    message =
      "Each order can build a hyperstructure by sending it resources. As the hyperstructure levels up, Realms of that order will get additional bonuses.";
  } else if (newLevel === 4) {
    title = "Unlocking Combat";
    message =
      "Because of the scarcity of resources, Realms will have to fight each other to survive. Combat is a key component of the game. You can send your Raiders to attack other Realms and steal their resources. You can also defend your Realm by building a Town Watch.";
  }

  return (
    <div className={"flex flex-col items-center justify-center p-4 border border-gold rounded-lg text-gold"}>
      <span className="uppercase mb-2">{`✨ ${title} ✨`}</span>
      <span className="">{message}</span>
    </div>
  );
};
