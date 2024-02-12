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
import useUIStore from "../../../hooks/store/useUIStore";
import { useExplore } from "../../../hooks/helpers/useExplore";
import hexDataJson from "../../../geodata/hex/hexData.json";
import { Hexagon } from "../HexGrid";

const hexData: Hexagon[] = hexDataJson as Hexagon[];

type RoadBuildPopupProps = {
  onClose: () => void;
};

export const ExploreMapPopup = ({ onClose }: RoadBuildPopupProps) => {
  const [step, setStep] = useState(1);

  const clickedHex = useUIStore((state) => state.clickedHex);

  const { getExplorationInput } = useExplore();

  const explorationInfo = useMemo(() => {
    if (clickedHex) {
      return getExplorationInput(clickedHex.col, clickedHex.row);
    }
  }, [clickedHex]);

  const { useFoundResources } = useExplore();
  let foundResource = useFoundResources(explorationInfo?.exploration.explored_by_id);

  const biome = useMemo(() => {
    if (clickedHex) {
      const hexIndex = hexData.findIndex((h) => h.col === clickedHex.col && h.row === clickedHex.row);
      return hexData[hexIndex].biome;
    }
  }, [clickedHex]);

  if (!explorationInfo || !biome) return null;

  return (
    <SecondaryPopup name="explore">
      <SecondaryPopup.Head onClose={onClose}>
        <div className="flex items-center space-x-1">
          <div className="mr-0.5">Explore the map</div>
        </div>
      </SecondaryPopup.Head>
      <SecondaryPopup.Body width={"800px"} height={"550px"}>
        {step === 1 && (
          <div className="flex flex-col items-center p-2">
            <ExplorePanel
              explorationStart={explorationInfo}
              foundResource={foundResource}
              setStep={setStep}
              onClose={onClose}
            />
          </div>
        )}
        {step === 2 && (
          <div className="flex flex-col items-center p-2">
            <ExploreResultPanel biome={biome} foundResource={foundResource} onClose={onClose} />
          </div>
        )}
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

type ExplorePanelProps = {
  explorationStart: { exploration: any; direction: number };
  foundResource: Resource | undefined;
  targetHex?: { col: number; row: number };
  setStep: Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
};

export const ExplorePanel = ({ explorationStart, foundResource, onClose, setStep }: ExplorePanelProps) => {
  const {
    setup: {
      systemCalls: { explore },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<bigint>();
  const [idsCanExplore, setIdsCanExplore] = useState<bigint[]>([]);
  const { getFoodResources } = useResources();

  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);
  const clickedHex = useUIStore((state) => state.clickedHex);

  const clickedHexMemoized = useMemo(() => clickedHex, []);

  const explorationCost: Resource[] = [
    {
      resourceId: 254,
      amount: 300000,
    },
    { resourceId: 255, amount: 150000 },
  ];

  useEffect(() => {
    let ids: bigint[] = [];
    const wheatCost = explorationCost.find((resource) => resource.resourceId === 254)?.amount || 0;
    const fishCost = explorationCost.find((resource) => resource.resourceId === 255)?.amount || 0;
    realmEntityIds.forEach(({ realmEntityId }) => {
      const food = getFoodResources(realmEntityId);
      const wheatBalance = food.find((resource) => resource.resourceId === 254)?.amount || 0;
      const fishBalance = food.find((resource) => resource.resourceId === 255)?.amount || 0;

      if (wheatBalance && wheatBalance >= wheatCost && fishBalance && fishBalance >= fishCost) {
        ids.push(realmEntityId);
      }
    });
    setIdsCanExplore(ids);
  }, [realmEntityIds]);

  useEffect(() => {
    setSelectedEntityId(explorationStart.exploration.explored_by_id);
  }, [explorationStart]);

  const onClick = () => {
    // do something
    onExplore();
  };

  const onExplore = async () => {
    setIsLoading(true);
    if (!selectedEntityId || !clickedHexMemoized) return;
    await explore({
      //   realm_entity_id: selectedEntityId,
      realm_entity_id: explorationStart.exploration.explored_by_id,
      col: explorationStart.exploration.col,
      row: explorationStart.exploration.row,
      direction: explorationStart.direction,
      signer: account,
    });
  };

  useEffect(() => {
    if (foundResource) {
      setIsLoading(false);
      setStep(2);
    }
  }, [foundResource]);

  // do a use component value to wait for the exploration tx to be finished
  // then go to next step

  return (
    <>
      <div className="flex flex-col items-center p-2">
        <Headline> Explore the map</Headline>
        <div className={"relative w-full mt-3"}>
          <img src={`/images/biomes/exploration.png`} className="object-cover w-full h-full rounded-[10px]" />
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
      <div className="w-full flex flex-col m-2 items-center text-xxs">
        {/* <div className="flex w-[80%] justify-between items-center mb-2">
          <SelectEntityId
            entityIds={realmEntityIds.map((realmEntityId) => realmEntityId.realmEntityId)}
            selectedEntityId={selectedEntityId}
            idsCanExplore={idsCanExplore}
            setSelectedEntityId={setSelectedEntityId}
          ></SelectEntityId>
        </div> */}
        <div className="flex flex-col items-center justify-center">
          <div className="flex">
            {/* <Button
              className="!px-[6px] mr-2 !py-[2px] text-xxs ml-auto"
              onClick={onClose}
              variant="outline"
              withoutSound
            >
              {`Cancel`}
            </Button> */}
            <Button
              className="!px-[8px] !py-[5px] ml-auto text-lg h-7 "
              size="md"
              disabled={idsCanExplore.find((id) => id === selectedEntityId) ? false : true}
              isLoading={isLoading}
              onClick={onClick}
              variant="outline"
              withoutSound
            >
              {`Explore`}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

type SelectEntityIdProps = {
  entityIds: bigint[];
  idsCanExplore: bigint[];
  setSelectedEntityId: (id: bigint) => void;
  selectedEntityId: bigint | undefined;
};

const SelectEntityId = ({ entityIds, idsCanExplore, setSelectedEntityId, selectedEntityId }: SelectEntityIdProps) => {
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
    <div className="w-full flex flex-row justify-between">
      {names.map((name, index) => (
        <Button
          variant={selectedEntityId === name.entityId ? "primary" : "outline"}
          size="xs"
          className={""}
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

type ExploreResultPanelProps = {
  biome: string;
  foundResource: Resource | undefined;
  onClose: () => void;
};

const ExploreResultPanel = ({ biome, foundResource, onClose }: ExploreResultPanelProps) => {
  let success = true;

  const [step, setStep] = useState(1);

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

            {step === 1 && (
              <div className="text-[#86C16A] text-xs mx-2 flex-1 text-center">You discovered a new environment !</div>
            )}
            {step !== 1 && <div className="text-[#86C16A] text-xs mx-2 flex-1 text-center">You found a chess!</div>}
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
          {step === 1 && (
            <div className="italic text-light-pink text-xxs my-2 uppercase"> {biome.split("_").join(" ")} </div>
          )}
          {step !== 1 && <div className="italic text-light-pink text-xxs my-2">You’ve got a golden chest:</div>}
          {step === 1 && (
            <div className="flex relative">
              <img
                src={`/images/biomes/${biome.toLowerCase()}.png`}
                className="object-cover w-full h-full rounded-[10px]"
              />
            </div>
          )}
          {step === 2 && <img src={`/images/chest.png`} className="object-contain w-full h-[450px] rounded-[10px]" />}
          {step === 3 && (
            <div className="flex relative">
              <img src={`/images/opened_chest.png`} className="object-contain w-full h-[450px] rounded-[10px]" />
              {foundResource && (
                <div className="flex justify-center items-center space-x-1 flex-wrap p-2 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="text-light-pink text-lg w-full mb-2 text-center italic">You won!</div>
                  <div key={foundResource.resourceId} className="flex flex-col items-center justify-center">
                    <ResourceIcon size="xxl" resource={findResourceById(foundResource.resourceId)?.trait || ""} />
                    <div className="text-sm mt-1 text-order-brilliance">
                      +
                      {Intl.NumberFormat("en-US", {
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(divideByPrecision(Number(foundResource.amount)) || 0)}
                    </div>
                  </div>
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
