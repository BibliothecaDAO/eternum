import { useMemo, useState } from "react";
import { SecondaryPopup } from "@/ui/elements/SecondaryPopup";
import { Tabs } from "@/ui/elements/tab";
import Button from "@/ui/elements/Button";
import { useDojo } from "@/hooks/context/DojoContext";
import { Has, getComponentValue, runQuery } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { Headline } from "@/ui/elements/Headline";
import { SelectLocationPanel } from "./SelectLocationPanel";

type TravelEntityPopupProps = {
  entityId: bigint;
  onClose: () => void;
};

export const TravelEntityPopup = ({ entityId, onClose }: TravelEntityPopupProps) => {
  const {
    setup: {
      components: { Position, Realm, Bank },
      systemCalls: { travel },
    },
    account: { account },
  } = useDojo();

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedEntityId, setSelectedEntityId] = useState<bigint | undefined>();
  const [loading, setLoading] = useState(false);

  const destinationPosition = selectedEntityId
    ? getComponentValue(Position, getEntityIdFromKeys([BigInt(selectedEntityId)]))
    : undefined;

  const onTravel = async () => {
    if (destinationPosition && entityId) {
      setLoading(true);
      await travel({
        signer: account,
        travelling_entity_id: entityId,
        destination_coord_x: destinationPosition.x,
        destination_coord_y: destinationPosition.y,
      });
      setLoading(false);
      onClose();
    }
  };

  const realms = Array.from(runQuery([Has(Realm)]));
  const banks = Array.from(runQuery([Has(Bank)]));

  const tabs = useMemo(
    () => [
      {
        key: "realms",
        label: <div>Realms</div>,
        component: (
          <SelectLocationPanel
            travelingEntityId={entityId}
            entityIds={realms}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          ></SelectLocationPanel>
        ),
      },
      {
        key: "banks",
        label: <div>Banks</div>,
        component: (
          <SelectLocationPanel
            travelingEntityId={entityId}
            entityIds={banks}
            selectedEntityId={selectedEntityId}
            setSelectedEntityId={setSelectedEntityId}
          ></SelectLocationPanel>
        ),
      },
    ],
    [selectedTab, selectedEntityId],
  );

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Travel Entity:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"550px"}>
        <div className="flex flex-col items-center p-2">
          <Headline>Choose Destination</Headline>
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
                    disabled={!selectedEntityId}
                    variant="outline"
                    withoutSound
                  >
                    {`Travel`}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};
