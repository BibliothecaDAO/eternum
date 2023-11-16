import { useEffect, useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../elements/SecondaryPopup";
import Button from "../../../../elements/Button";
import { Headline } from "../../../../elements/Headline";
import { ResourceCost } from "../../../../elements/ResourceCost";
import useRealmStore from "../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { divideByPrecision, getEntityIdFromKeys } from "../../../../utils/utils";
import { useRealm } from "../../../../hooks/helpers/useRealm";
import { getLevelingCost } from "./utils";

type LevelingPopupProps = {
  onClose: () => void;
};

export const LevelingPopup = ({ onClose }: LevelingPopupProps) => {
  const {
    setup: {
      components: { Resource },
      systemCalls: { level_up },
    },
    account: { account },
  } = useDojo();

  const [canBuild, setCanBuild] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  let { realmEntityId } = useRealmStore();

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  const { getRealmLevel } = useRealm();

  const level = realmEntityId ? getRealmLevel(realmEntityId) : undefined;

  const newLevel = useMemo(() => {
    // don't update if click on level_up
    return level?.level + 1 || 1;
  }, []);

  // TODO: get info from contract config file
  // calculate the costs of building/buying tools
  let costResources = useMemo(() => {
    return getLevelingCost(newLevel);
  }, [newLevel]);

  const onBuild = async () => {
    if (realmEntityId) {
      setIsLoading(true);
      await level_up({ realm_entity_id: realmEntityId, signer: account });
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
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Level up to level {newLevel}</Headline>
          <div className={"relative w-full mt-3"}>
            <img
              src={`/images/levels/level${newLevel.toString()}.png`}
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
          <div className="flex flex-col items-center justify-center">
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
