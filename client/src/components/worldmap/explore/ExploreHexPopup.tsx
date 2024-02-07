import { Dispatch, useEffect, useMemo, useState } from "react";
import { Resource, findResourceById } from "@bibliothecadao/eternum";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useResources } from "../../../hooks/helpers/useResources";
import { useDojo } from "../../../DojoContext";
import { Headline } from "../../../elements/Headline";
import { SecondaryPopup } from "../../../elements/SecondaryPopup";
import { ResourceCost } from "../../../elements/ResourceCost";
import { divideByPrecision, getEntityIdFromKeys } from "../../../utils/utils";
import Button from "../../../elements/Button";
import { getRealm } from "../../../utils/realms";
import { getComponentValue } from "@dojoengine/recs";
import { ResourceIcon } from "../../../elements/ResourceIcon";

type RoadBuildPopupProps = {
  onClose: () => void;
};

export const ExploreMapPopup = ({ onClose }: RoadBuildPopupProps) => {
  const [step, setStep] = useState(1);
  return (
    <SecondaryPopup name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Explore the map</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"410px"}>
        {step === 1 && (
          <div className="flex flex-col items-center p-2">
            <ExplorePanel setStep={setStep} onClose={onClose} />
          </div>
        )}
        {step === 2 && (
          <div className="flex flex-col items-center p-2">
            <ExploreResultPanel onClose={onClose} />
          </div>
        )}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

type ExplorePanelProps = {
  targetHex?: { col: number; row: number };
  setStep: Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
};

export const ExplorePanel = ({ onClose, setStep }: ExplorePanelProps) => {
  const [selectedEntityId, setSelectedEntityId] = useState<bigint>();
  const [idsCanExplore, setIdsCanExplore] = useState<bigint[]>([]);
  const { getFoodResources } = useResources();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const explorationCost: Resource[] = [
    {
      resourceId: 254,
      amount: 100000,
    },
    { resourceId: 255, amount: 100000 },
  ];

  useEffect(() => {
    const wheatCost = explorationCost.find((resource) => resource.resourceId === 254)?.amount || 0;
    const fishCost = explorationCost.find((resource) => resource.resourceId === 255)?.amount || 0;
    realmEntityIds.forEach(({ realmEntityId }) => {
      const food = getFoodResources(realmEntityId);
      const wheatBalance = food.find((resource) => resource.resourceId === 254)?.amount || 0;
      const fishBalance = food.find((resource) => resource.resourceId === 255)?.amount || 0;

      if (wheatBalance && wheatBalance >= wheatCost && fishBalance && fishBalance >= fishCost) {
        setIdsCanExplore((ids) => [...ids, realmEntityId]);
      }
    });
  }, [realmEntityIds]);

  const onExplore = () => {
    setStep(2);
  };

  return (
    <SecondaryPopup>
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Build road:</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"376px"}>
        <div className="flex flex-col items-center p-2">
          <Headline> Explore the map</Headline>
          <div className={"relative w-full mt-3"}>
            <img src={`/images/road.jpg`} className="object-cover w-full h-full rounded-[10px]" />
            <div className="flex flex-col p-2 absolute left-2 bottom-2 rounded-[10px] bg-black/60">
              <div className="mb-1 ml-1 italic text-light-pink text-xxs">Price:</div>
              <div className="grid grid-cols-4 gap-2">
                {explorationCost.map(({ resourceId, amount }) => (
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
          <div className="flex items-center">
            <SelectEntityId
              entityIds={realmEntityIds.map((realmEntityId) => realmEntityId.realmEntityId)}
              idsCanExplore={idsCanExplore}
              setSelectedEntityId={setSelectedEntityId}
            ></SelectEntityId>
          </div>
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
                disabled={!selectedEntityId}
                onClick={onExplore}
                variant="outline"
                withoutSound
              >
                {`Explore`}
              </Button>
            </div>
          </div>
        </div>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

type SelectEntityIdProps = {
  entityIds: bigint[];
  idsCanExplore: bigint[];
  setSelectedEntityId: (id: bigint) => void;
};

const SelectEntityId = ({ entityIds, idsCanExplore, setSelectedEntityId }: SelectEntityIdProps) => {
  const {
    setup: {
      components: { Realm },
    },
  } = useDojo();

  const names = entityIds.map((entityId) => {
    // get the name
    const realm = getComponentValue(Realm, getEntityIdFromKeys([entityId]));
    return { entityId, name: realm ? getRealm(realm?.realm_id)?.name : "" };
  });
  return (
    <div className="flex flex-col justify-between">
      {names.map((name, index) => (
        <Button
          className={"mx-1"}
          disabled={!idsCanExplore.find((id) => id === BigInt(name.entityId))}
          onClick={() => setSelectedEntityId(name.entityId)}
          key={index}
        >
          {name.name}
        </Button>
      ))}
      ;
    </div>
  );
};

const ExploreResultPanel = ({ onClose }: { onClose: () => void }) => {
  let success = true;

  const [step, setStep] = useState(1);

  const inventoryResources: Resource[] = [
    {
      resourceId: 1,
      amount: 10000,
    },
  ];

  return (
    <div className="flex flex-col items-center w-full">
      {success && (
        <>
          <div className="flex w-full items-center">
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M131.887 6L129 8.88675L126.113 6L129 3.11325L131.887 6ZM129 6.5L1.23874 6.50001L1.23874 5.50001L129 5.5L129 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M17.5986 1L22.2782 4L28.5547 6.00003L22.2782 8L17.5986 11L11 6.5C11 6.5 7.41876 8 5.95938 8C4.5 8 0.999649 6.00003 0.999649 6.00003C0.999649 6.00003 4.5 4 5.95938 4C7.41876 4 11 5.5 11 5.5L17.5986 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="17.5" cy="6" r="1.5" fill="#1B1B1B" />
              <circle cx="6" cy="6" r="1" fill="#1B1B1B" />
            </svg>

            <div className="text-[#86C16A] text-xs mx-2 flex-1 text-center">Succesfull pillage!</div>
            <svg width="132" height="12" viewBox="0 0 132 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M0.113249 6L3 8.88675L5.88675 6L3 3.11325L0.113249 6ZM3 6.5L130.761 6.50001L130.761 5.50001L3 5.5L3 6.5Z"
                fill="#86C16A"
              />
              <path
                d="M114.401 1L109.722 4L103.445 6.00003L109.722 8L114.401 11L121 6.5C121 6.5 124.581 8 126.041 8C127.5 8 131 6.00003 131 6.00003C131 6.00003 127.5 4 126.041 4C124.581 4 121 5.5 121 5.5L114.401 1Z"
                fill="#86C16A"
                stroke="#86C16A"
                strokeLinejoin="round"
              />
              <circle cx="1.5" cy="1.5" r="1.5" transform="matrix(-1 0 0 1 116 4.5)" fill="#1B1B1B" />
              <circle cx="1" cy="1" r="1" transform="matrix(-1 0 0 1 127 5)" fill="#1B1B1B" />
            </svg>
          </div>
          {step === 1 && <div className="italic text-light-pink text-xxs my-2">You have discovered a new place:</div>}
          {step !== 1 && <div className="italic text-light-pink text-xxs my-2">You’ve got a golden chest:</div>}
          {step === 1 && (
            <div className="flex relative">
              <img src={`/images/pillage/pillage1.png`} className="object-cover w-full h-full rounded-[10px]" />
              <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-70 rounded-lg"></div>
            </div>
          )}
          {step === 2 && <img src={`/images/chest.png`} className="object-cover w-full h-full rounded-[10px]" />}
          {step === 3 && (
            <div className="flex relative">
              <img src={`/images/opened_chest.png`} className="object-cover w-full h-full rounded-[10px]" />
              {inventoryResources && (
                <div className="flex justify-center items-center space-x-1 flex-wrap p-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="text-light-pink text-lg w-full mb-2 text-center italic">You won!</div>
                  {inventoryResources.map(
                    (resource) =>
                      resource && (
                        <div key={resource.resourceId} className="flex flex-col items-center justify-center">
                          <ResourceIcon size="md" resource={findResourceById(resource.resourceId)?.trait || ""} />
                          <div className="text-sm mt-1 text-order-brilliance">
                            +
                            {Intl.NumberFormat("en-US", {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }).format(divideByPrecision(Number(resource.amount)) || 0)}
                          </div>
                        </div>
                      ),
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="flex justify-center mt-2 text-xxs w-full">
        <Button
          size="xs"
          onClick={() => {
            if (step === 1) setStep(2);
            else if (success && step === 2) {
              setStep(3);
            } else {
              onClose();
            }
          }}
          variant="outline"
        >
          {step === 1 ? "Search For Chest" : success && step === 2 ? `Open Chest` : "Close"}
        </Button>
      </div>
    </div>
  );
};
