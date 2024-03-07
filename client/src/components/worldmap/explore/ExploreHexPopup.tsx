import { Dispatch, useEffect, useMemo, useState } from "react";
import React from "react";
import { Resource, findResourceById } from "@bibliothecadao/eternum";
import useRealmStore from "../../../hooks/store/useRealmStore";
import { useDojo } from "../../../DojoContext";
import { ResourceCost } from "../../../elements/ResourceCost";
import { divideByPrecision, findDirection, getEntityIdFromKeys } from "../../../utils/utils";
import Button from "../../../elements/Button";
import { ResourceIcon } from "../../../elements/ResourceIcon";
import useUIStore from "../../../hooks/store/useUIStore";
import { useExplore } from "../../../hooks/helpers/useExplore";
import { useResources } from "../../../hooks/helpers/useResources";
import { getComponentValue } from "@dojoengine/recs";

type ExploreMapPopupProps = {};

export const ExploreMapPopup = ({}: ExploreMapPopupProps) => {
  const [step, setStep] = useState(1);

  const setSelectedEntity = useUIStore((state) => state.setSelectedEntity);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const selectedPath = useUIStore((state) => state.selectedPath);
  const hexData = useUIStore((state) => state.hexData);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);

  const { useFoundResources } = useExplore();
  let foundResource = useFoundResources(selectedPath?.id);

  const biome = useMemo(() => {
    if (selectedPath?.path.length === 2 && hexData) {
      const hexIndex = hexData.findIndex((h) => h.col === selectedPath?.path[1].x && h.row === selectedPath?.path[1].y);
      return hexData[hexIndex].biome;
    }
  }, [selectedPath, hexData]);

  const onClose = () => {
    setSelectedEntity(undefined);
    setSelectedPath(undefined);
    setIsExploreMode(false);
  };

  const direction =
    selectedPath?.path.length === 2
      ? findDirection(
          { col: selectedPath.path[0].x, row: selectedPath.path[0].y },
          { col: selectedPath.path[1].x, row: selectedPath.path[1].y },
        )
      : undefined;

  return (
    <div>
      {step === 1 && (
        <ExplorePanel
          explorerId={selectedPath?.id}
          explorationStart={selectedPath?.path[0]}
          direction={direction}
          foundResource={foundResource}
          setStep={setStep}
          onClose={onClose}
        />
      )}
      {step === 2 && biome && (
        <div className="flex flex-col items-center p-2">
          <ExploreResultPanel biome={biome} foundResource={foundResource} onClose={onClose} />
        </div>
      )}
    </div>
  );
};

type ExplorePanelProps = {
  explorerId: bigint | undefined;
  explorationStart: { x: number; y: number } | undefined;
  direction: number | undefined;
  foundResource: Resource | undefined;
  targetHex?: { col: number; row: number };
  setStep: Dispatch<React.SetStateAction<number>>;
  onClose: () => void;
};

export const ExplorePanel = ({
  explorerId,
  explorationStart,
  direction,
  foundResource,
  onClose,
  setStep,
}: ExplorePanelProps) => {
  const {
    setup: {
      components: { EntityOwner },
      systemCalls: { explore },
    },
    account: { account },
  } = useDojo();

  const [isLoading, setIsLoading] = useState(false);
  const setSelectedPath = useUIStore((state) => state.setSelectedPath);
  const setIsExploreMode = useUIStore((state) => state.setIsExploreMode);

  const explorationCost: Resource[] = [
    {
      resourceId: 254,
      amount: 300000,
    },
    { resourceId: 255, amount: 150000 },
  ];

  useEffect(() => {
    if (!explorerId) return;
    // get the food resources
    const entityOwner = getComponentValue(EntityOwner, getEntityIdFromKeys([explorerId]));
    if (!entityOwner) return;
  }, [explorerId]);

  const onExplore = async () => {
    setIsLoading(true);
    if (!explorerId || !explorationStart || direction === undefined) return;
    await explore({
      unit_id: explorerId,
      direction,
      signer: account,
    });
    // setStep(2);
  };

  useEffect(() => {
    if (foundResource) {
      setIsLoading(false);
      setStep(2);
    }
  }, [foundResource]);

  // do a use component value to wait for the exploration tx to be finished
  // then go to next step
  const onCancelSelection = () => {
    setSelectedPath(undefined);
  };

  const onCancelExplore = () => {
    setIsExploreMode(false);
  };

  const canExplore = explorerId !== undefined && explorationStart !== undefined && direction !== undefined;

  return (
    <>
      <div className={"relative w-full mt-3"}>
        <img src={`/images/biomes/exploration.png`} className="object-cover w-full h-[200px] rounded-[10px]" />
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
      <div className="w-full flex flex-col m-2 items-center text-xxs">
        <div className="flex w-full items-center justify-center">
          <div className="flex mt-1 w-[85%] items-center justify-center">
            <Button
              variant="primary"
              size="md"
              isLoading={isLoading}
              disabled={!canExplore}
              onClick={onExplore}
              className="mr-3"
            >
              Explore
            </Button>
            {canExplore && (
              <Button variant="primary" size="md" onClick={onCancelSelection} className="mr-3">
                Cancel Selection
              </Button>
            )}
            {!canExplore && (
              <Button variant="primary" size="md" onClick={onCancelExplore} className="mr-3">
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
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
          {/* <div className="flex w-full items-center">
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
          </div> */}
          {/* {step === 1 && (
            <div className="italic text-light-pink text-xxs my-2 uppercase"> {biome.split("_").join(" ")} </div>
          )}
          {step !== 1 && <div className="italic text-light-pink text-xxs my-2">You’ve got a golden chest:</div>} */}
          {step === 1 && (
            <div className="flex relative">
              <img
                src={`/images/biomes/${biome.toLowerCase()}.png`}
                className="object-cover w-full h-[230px] rounded-[10px]"
              />
            </div>
          )}
          {step === 2 && <img src={`/images/chest.png`} className="object-cover rounded-[10px]" />}
          {step === 3 && (
            <div className="flex relative">
              <img src={`/images/opened_chest.png`} className="object-cover rounded-[10px]" />
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
