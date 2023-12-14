import { useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { SelectRealmForCombatPanel } from "./SelectRealmForCombatPanel";
import { CombatInfo } from "@bibliothecadao/eternum";

type TravelRaidsPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const TravelRaidsPopup = ({ selectedRaider, onClose }: TravelRaidsPopupProps) => {
  const {
    setup: {
      components: { Position },
      systemCalls: { travel },
    },
    account: { account },
  } = useDojo();

  const [selectedEntityId, setSelectedEntityId] = useState<number | undefined>();
  const [canAttack, setCanAttack] = useState(true);
  const [loading, setLoading] = useState(false);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const destinationPosition = selectedEntityId
    ? getComponentValue(Position, getEntityIdFromKeys([BigInt(selectedEntityId)]))
    : undefined;

  const onTravel = async () => {
    if (destinationPosition && selectedRaider?.entityId) {
      setLoading(true);
      await travel({
        signer: account,
        travelling_entity_id: selectedRaider.entityId,
        destination_coord_x: destinationPosition.x,
        destination_coord_y: destinationPosition.y,
      });
      setLoading(false);
      onClose();
    }
  };

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Travel Raiders:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"450px"}>
        <div className="flex flex-col items-center p-2">
          <SelectRealmForCombatPanel
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
            setCanAttack={setCanAttack}
          ></SelectRealmForCombatPanel>
          <div className="flex mt-2 flex-col items-center justify-center">
            <div className="flex">
              {!loading && (
                <Button
                  className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
                  onClick={onClose}
                  variant="outline"
                  withoutSound
                >
                  {`Cancel`}
                </Button>
              )}

              <Button
                className="!px-[6px] !py-[2px] text-xxs ml-auto"
                isLoading={loading}
                onClick={onTravel}
                disabled={!selectedEntityId || !canAttack}
                variant="outline"
                withoutSound
              >
                {`Travel`}
              </Button>
            </div>
            {!canAttack && (
              <div className="text-order-giants my-1 text-xxs"> Can only attack Realms level 3 or higher </div>
            )}
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
