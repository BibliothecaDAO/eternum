import { useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@latticexyz/recs";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { CombatInfo } from "../../../../../hooks/helpers/useCombat";
import { SelectRealmPanel } from "./SelectRealmPanel";
import { useHyperstructure } from "../../../../../hooks/helpers/useHyperstructure";

type RoadBuildPopupProps = {
  selectedRaider: CombatInfo;
  onClose: () => void;
};

export const TravelRaidsPopup = ({ selectedRaider, onClose }: RoadBuildPopupProps) => {
  const {
    setup: {
      components: { Position },
      systemCalls: { travel },
    },
    account: { account },
  } = useDojo();

  const [selectedEntityId, setSelectedEntityId] = useState<number | undefined>();
  const [loading, setLoading] = useState(false);

  const realmEntityId = useRealmStore((state) => state.realmEntityId);

  // @ts-ignore
  const { realm } = useGetRealm(realmEntityId);

  const destinationPosition = selectedEntityId
    ? getComponentValue(Position, getEntityIdFromKeys([BigInt(selectedEntityId)]))
    : undefined;

  const { getHyperstructureIdByRealmEntityId } = useHyperstructure();

  const order_hyperstructure_id = realmEntityId ? getHyperstructureIdByRealmEntityId(realmEntityId) : undefined;

  const onTravel = async () => {
    if (destinationPosition) {
      setLoading(true);
      await travel({
        signer: account,
        travelling_entity_id: selectedRaider.entityId,
        destination_coord_x: destinationPosition.x,
        destination_coord_y: destinationPosition.y,
        order_hyperstructure_id,
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
          <SelectRealmPanel
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          ></SelectRealmPanel>
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
              {!loading && (
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  onClick={onTravel}
                  disabled={!selectedEntityId}
                  variant="outline"
                  withoutSound
                >
                  {`Travel`}
                </Button>
              )}
              {loading && (
                <Button
                  className="!px-[6px] !py-[2px] text-xxs ml-auto"
                  onClick={() => {}}
                  isLoading={true}
                  variant="outline"
                  withoutSound
                >
                  {}
                </Button>
              )}
            </div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
