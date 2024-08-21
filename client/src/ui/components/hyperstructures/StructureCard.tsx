import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { getStructureAtPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { StructureListItem } from "../worldmap/structures/StructureListItem";

export const StructureCard = ({
  position,
  ownArmySelected,
}: {
  position: Position;
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);
  const structure = getStructureAtPosition(position.getContract());

  return (
    Boolean(structure) && (
      <div className="px-2 w-[31rem] py-2">
        Structure
        {!showMergeTroopsPopup && (
          <StructureListItem
            structure={structure!}
            ownArmySelected={ownArmySelected}
            setShowMergeTroopsPopup={setShowMergeTroopsPopup}
          />
        )}
        {showMergeTroopsPopup && (
          <div className="flex flex-col w-[100%] mt-2">
            {ownArmySelected && (
              <MergeTroopsPanel
                giverArmy={ownArmySelected}
                setShowMergeTroopsPopup={setShowMergeTroopsPopup}
                structureEntityId={structure!.entity_id}
              />
            )}
          </div>
        )}
      </div>
    )
  );
};

type MergeTroopsPanelProps = {
  giverArmy: ArmyInfo;
  takerArmy?: ArmyInfo;
  setShowMergeTroopsPopup: (val: boolean) => void;
  structureEntityId?: ID;
};

export const MergeTroopsPanel = ({
  giverArmy,
  setShowMergeTroopsPopup,
  structureEntityId,
  takerArmy,
}: MergeTroopsPanelProps) => {
  return (
    <div className="flex flex-col  bg-gold/20 p-3 max-h-[42vh] overflow-y-auto">
      <Button className="mb-3 w-[30%]" variant="default" size="xs" onClick={() => setShowMergeTroopsPopup(false)}>
        &lt; Back
      </Button>
      <TroopExchange
        giverArmy={giverArmy}
        takerArmy={takerArmy}
        giverArmyEntityId={giverArmy.entity_id}
        structureEntityId={structureEntityId}
      />
    </div>
  );
};

type TroopsProps = {
  giverArmy: ArmyInfo;
  takerArmy?: ArmyInfo;
  giverArmyEntityId: ID;
  structureEntityId?: ID;
};

const troopsToFormat = (troops: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint }) => {
  return {
    [ResourcesIds.Crossbowman]: troops.crossbowman_count,
    [ResourcesIds.Knight]: troops.knight_count,
    [ResourcesIds.Paladin]: troops.paladin_count,
  };
};

const TroopExchange = ({ giverArmy, giverArmyEntityId, structureEntityId, takerArmy }: TroopsProps) => {
  const {
    setup: {
      account: { account },
      components: { Army, Protector },
      systemCalls: { army_merge_troops, create_army },
    },
  } = useDojo();

  const [loading, setLoading] = useState<boolean>(false);

  const [troopsGiven, setTroopsGiven] = useState<Record<number, bigint>>({
    [ResourcesIds.Crossbowman]: 0n,
    [ResourcesIds.Knight]: 0n,
    [ResourcesIds.Paladin]: 0n,
  });

  const protector = useComponentValue(Protector, getEntityIdFromKeys([BigInt(structureEntityId || 0)]));

  const createProtector = async () => {
    setLoading(true);
    await create_army({
      signer: account,
      is_defensive_army: true,
      army_owner_id: structureEntityId!,
    });
    setLoading(false);
  };

  const [transferDirection, setTransferDirection] = useState<"to" | "from">("to");

  const mergeTroops = async () => {
    setLoading(true);
    await army_merge_troops({
      signer: account,
      from_army_id: transferDirection === "to" ? giverArmyEntityId : takerArmy?.entity_id || protector!.army_id,
      to_army_id: transferDirection === "to" ? takerArmy?.entity_id || protector!.army_id : giverArmyEntityId,
      troops: {
        knight_count: troopsGiven[ResourcesIds.Knight] * BigInt(EternumGlobalConfig.resources.resourceMultiplier),
        paladin_count: troopsGiven[ResourcesIds.Paladin] * BigInt(EternumGlobalConfig.resources.resourceMultiplier),
        crossbowman_count:
          troopsGiven[ResourcesIds.Crossbowman] * BigInt(EternumGlobalConfig.resources.resourceMultiplier),
      },
    });
    setLoading(false);
    setTroopsGiven({
      [ResourcesIds.Crossbowman]: 0n,
      [ResourcesIds.Knight]: 0n,
      [ResourcesIds.Paladin]: 0n,
    });
  };

  const handleTroopsGivenChange = (resourceId: string, amount: bigint) => {
    setTroopsGiven((prev) => ({ ...prev, [resourceId]: amount }));
  };

  const giverArmyTroops = useComponentValue(Army, getEntityIdFromKeys([BigInt(giverArmyEntityId)]))!.troops;
  const receiverArmyTroops = useComponentValue(
    Army,
    getEntityIdFromKeys([BigInt(takerArmy?.entity_id || protector?.army_id || 0)]),
  )?.troops;

  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-around items-center">
        <div className="w-[60%] mr-1 bg-gold/20">
          <p className="pt-2 pb-1 text-center">{giverArmy.name}</p>
          {Object.entries(troopsToFormat(giverArmyTroops)).map(([resourceId, amount]: [string, bigint]) => {
            return (
              <div
                className="grid grid-cols-6 hover:bg-gold/30 justify-around items-center h-12 gap-2 px-1 mb-1"
                key={resourceId}
              >
                <Troop className="col-span-1" troopId={Number(resourceId)} />

                <div className="flex flex-col text-xs text-center self-center font-bold col-span-2">
                  <p>Avail.</p>
                  <p
                    className={`${
                      transferDirection === "to" &&
                      troopsGiven[Number(resourceId)] * BigInt(EternumGlobalConfig.resources.resourceMultiplier) !== 0n
                        ? "text-red"
                        : ""
                    }`}
                  >
                    {transferDirection === "to"
                      ? `[${currencyFormat(
                          amount -
                            troopsGiven[Number(resourceId)] * BigInt(EternumGlobalConfig.resources.resourceMultiplier),
                          0,
                        )}]`
                      : `[${currencyFormat(amount, 0)}]`}
                  </p>
                </div>

                {transferDirection === "to" && (
                  <NumberInput
                    className="col-span-3 rounded-lg"
                    max={Number(amount) / EternumGlobalConfig.resources.resourceMultiplier}
                    min={0}
                    step={100}
                    value={Number(troopsGiven[Number(resourceId)])}
                    onChange={(amount) => handleTroopsGivenChange(resourceId, BigInt(amount))}
                  />
                )}
                {transferDirection === "from" && (
                  <div
                    className={`text-lg font-bold col-span-3 text-center ${
                      troopsGiven[Number(resourceId)] !== 0n ? `text-green` : ""
                    }`}
                  >{`+${troopsGiven[Number(resourceId)]}`}</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-[60%] ml-1 bg-gold/20">
          <p className="pt-2 pb-1 text-center">Transfer {transferDirection}</p>
          {!protector && !takerArmy ? (
            <Button variant={"primary"} onClick={createProtector}>
              Create defending army
            </Button>
          ) : (
            receiverArmyTroops &&
            Object.entries(troopsToFormat(receiverArmyTroops!)).map(([resourceId, amount]: [string, bigint]) => {
              return (
                <div
                  className="grid grid-cols-6 hover:bg-gold/30 justify-around items-center h-12 gap-2 px-1 mb-1"
                  key={resourceId}
                >
                  <Troop troopId={Number(resourceId)} />

                  <div className="flex flex-col text-xs text-center self-center font-bold col-span-2">
                    <p>Avail.</p>
                    <p
                      className={`${
                        transferDirection === "from" &&
                        troopsGiven[Number(resourceId)] * BigInt(EternumGlobalConfig.resources.resourceMultiplier) !==
                          0n
                          ? "text-red"
                          : ""
                      }`}
                    >
                      {transferDirection === "from"
                        ? `[${currencyFormat(
                            amount -
                              troopsGiven[Number(resourceId)] *
                                BigInt(EternumGlobalConfig.resources.resourceMultiplier),
                            0,
                          )}]`
                        : `[${currencyFormat(amount, 0)}]`}
                    </p>
                  </div>
                  {transferDirection === "from" && (
                    <NumberInput
                      className="col-span-3 rounded-lg"
                      max={Number(amount) / EternumGlobalConfig.resources.resourceMultiplier}
                      min={0}
                      step={100}
                      value={Number(troopsGiven[Number(resourceId)])}
                      onChange={(amount) => handleTroopsGivenChange(resourceId, BigInt(amount))}
                    />
                  )}
                  {transferDirection === "to" && (
                    <div
                      className={`text-lg font-bold col-span-3 text-center ${
                        troopsGiven[Number(resourceId)] !== 0n ? `text-green` : ""
                      }`}
                    >{`+${troopsGiven[Number(resourceId)]}`}</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      <div className="my-3 w-full flex justify-center">
        <Button
          className="self-center m-auto h-[3vh] p-4"
          size="md"
          onClick={() => {
            setTransferDirection(transferDirection === "to" ? "from" : "to");
            setTroopsGiven({
              [ResourcesIds.Crossbowman]: 0n,
              [ResourcesIds.Knight]: 0n,
              [ResourcesIds.Paladin]: 0n,
            });
          }}
        >
          <ArrowRight size={24} className={`${transferDirection === "to" ? "" : "rotate-180"} duration-300`} />
        </Button>
      </div>

      <Button
        onClick={mergeTroops}
        isLoading={loading}
        variant="primary"
        disabled={Object.values(troopsGiven).every((amount) => amount === 0n) || (!protector && !takerArmy)}
      >
        Reinforce
      </Button>
    </div>
  );
};

const Troop = ({ troopId, className }: { troopId: number; className?: string }) => {
  const setTooltip = useUIStore((state) => state.setTooltip);

  return (
    <div
      onMouseEnter={() => {
        setTooltip({
          position: "top",
          content: <>{ResourcesIds[troopId]}</>,
        });
      }}
      onMouseLeave={() => {
        setTooltip(null);
      }}
      className={`flex flex-col font-bold ${className}`}
    >
      <ResourceIcon withTooltip={false} resource={ResourcesIds[troopId]} size="lg" />
    </div>
  );
};
