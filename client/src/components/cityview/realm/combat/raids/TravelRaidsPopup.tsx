import { useMemo, useState } from "react";
import { SecondaryPopup } from "../../../../../elements/SecondaryPopup";
import { Tabs } from "../../../../../elements/tab";
import Button from "../../../../../elements/Button";
import useRealmStore from "../../../../../hooks/store/useRealmStore";
import { useDojo } from "../../../../../DojoContext";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "../../../../../utils/utils";
import { useGetRealm } from "../../../../../hooks/helpers/useRealm";
import { SelectHyperstructureForCombat, SelectRealmForCombatPanel } from "./SelectRealmForCombatPanel";
import { CombatInfo } from "@bibliothecadao/eternum";
import { useLocation } from "wouter";
import { Headline } from "../../../../../elements/Headline";

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

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<bigint | undefined>();
  const [canAttack, setCanAttack] = useState(true);
  const [loading, setLoading] = useState(false);

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

  const tabs = useMemo(
    () => [
      {
        key: "realms",
        label: <div>Realms</div>,
        component: (
          <SelectRealmForCombatPanel
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
            setCanAttack={setCanAttack}
          ></SelectRealmForCombatPanel>
        ),
      },
      {
        key: "hyprestructures",
        label: <div>Hyperstructures</div>,
        component: (
          <SelectHyperstructureForCombat
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
            setCanAttack={setCanAttack}
          ></SelectHyperstructureForCombat>
        ),
      },
    ],
    [selectedTab, selectedEntityId],
  );

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Travel Raiders:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"550px"}>
        <div className="flex flex-col items-center p-2">
          <Headline size="big">Choose Destination</Headline>
          <div className="flex relative mt-1 justify-center text-xxs text-lightest w-full">
            <div className="flex flex-col w-full">
              <Tabs
                selectedIndex={selectedTab}
                onChange={(index: any) => setSelectedTab(index)}
                variant="default"
                className="h-full"
              >
                <Tabs.List>
                  {tabs.map((tab, index) => (
                    <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                  ))}
                </Tabs.List>
                <Tabs.Panels className="overflow-hidden">
                  {tabs.map((tab, index) => (
                    <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
                  ))}
                </Tabs.Panels>
              </Tabs>
              <div className="flex mt-2 flex-col items-end h-full">
                <div className="flex justify-end">
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
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
