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
