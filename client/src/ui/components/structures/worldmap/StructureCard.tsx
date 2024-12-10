import { configManager } from "@/dojo/setup";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { useGuilds } from "@/hooks/helpers/useGuilds";
import { useQuery } from "@/hooks/helpers/useQuery";
import { useIsStructureImmune, useStructureAtPosition, useStructureImmunityTimer } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/types/Position";
import { ArmyCapacity } from "@/ui/elements/ArmyCapacity";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/elements/Tabs";
import { getTotalTroops } from "@/ui/modules/military/battle-view/BattleHistory";
import { currencyFormat, formatNumber, formatStringNumber } from "@/ui/utils/utils";
import { ContractAddress, ID, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { ResourceExchange } from "../../hyperstructures/ResourceExchange";
import { ImmunityTimer } from "../../worldmap/structures/StructureLabel";
import { StructureListItem } from "../../worldmap/structures/StructureListItem";

export const StructureCard = ({
  className,
  position,
  ownArmySelected,
}: {
  className?: string;
  position: Position;
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);

  const nextBlockTimestamp = useUIStore((state) => state.nextBlockTimestamp);

  const { handleUrlChange } = useQuery();

  const { getGuildFromPlayerAddress } = useGuilds();

  const structure = useStructureAtPosition(position.getContract());

  const playerGuild = getGuildFromPlayerAddress(ContractAddress(structure?.owner.address || 0n));

  const isImmune = useIsStructureImmune(structure, nextBlockTimestamp || 0);
  const timer = useStructureImmunityTimer(structure, nextBlockTimestamp || 0);

  const goToHexView = () => {
    const url = position.toHexLocationUrl();
    handleUrlChange(url);
  };

  return (
    Boolean(structure) && (
      <div className={`px-2 py-2 ${className}`}>
        <div className="ml-2">
          <Button
            variant="outline"
            size="xs"
            className={clsx("self-center")}
            onClick={() => {
              goToHexView();
            }}
          >
            View {structure?.category}
          </Button>
        </div>
        {!showMergeTroopsPopup && (
          <>
            <Headline className="text-center text-lg">
              <div>{structure?.ownerName}</div>
              {playerGuild && (
                <div>
                  {"< "}
                  {playerGuild.name}
                  {" >"}
                </div>
              )}
            </Headline>
            <StructureListItem
              structure={structure!}
              ownArmySelected={ownArmySelected}
              setShowMergeTroopsPopup={setShowMergeTroopsPopup}
              showButtons={true}
            />
            <ImmunityTimer isImmune={isImmune} timer={timer} className="w-[27rem]" />
          </>
        )}
        {showMergeTroopsPopup && (
          <div className="flex flex-col mt-2">
            {ownArmySelected && (
              <StructureMergeTroopsPanel
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

const StructureMergeTroopsPanel = ({
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
        giverArmyName={giverArmy.name}
        takerArmy={takerArmy}
        giverArmyEntityId={giverArmy.entity_id}
        structureEntityId={structureEntityId}
      />
    </div>
  );
};

type TroopsProps = {
  giverArmyName: string;
  takerArmy?: ArmyInfo;
  giverArmyEntityId: ID;
  structureEntityId?: ID;
  allowReverse?: boolean;
};

const troopsToFormat = (troops: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint }) => {
  return {
    [ResourcesIds.Crossbowman]: troops.crossbowman_count,
    [ResourcesIds.Knight]: troops.knight_count,
    [ResourcesIds.Paladin]: troops.paladin_count,
  };
};

export const Exchange = ({
  giverArmyName,
  giverArmyEntityId,
  structureEntityId,
  takerArmy,
  allowReverse,
}: TroopsProps) => {
  return (
    <Tabs defaultValue="troops" className="w-full">
      <TabsList className="grid w-full grid-cols-2 gap-4">
        <TabsTrigger value="troops" className="border hover:opacity-70">
          Troops
        </TabsTrigger>
        <TabsTrigger value="resources" className="border hover:opacity-70">
          Resources
        </TabsTrigger>
      </TabsList>
      <TabsContent value="troops">
        <TroopExchange
          giverArmyName={giverArmyName}
          giverArmyEntityId={giverArmyEntityId}
          structureEntityId={structureEntityId}
          takerArmy={takerArmy}
          allowReverse={allowReverse}
        />
      </TabsContent>
      <TabsContent value="resources">
        <ResourceExchange
          giverArmyName={giverArmyName}
          giverArmyEntityId={giverArmyEntityId}
          structureEntityId={structureEntityId}
          takerArmy={takerArmy}
          allowReverse={allowReverse}
        />
      </TabsContent>
    </Tabs>
  );
};

const TroopExchange = ({
  giverArmyName,
  giverArmyEntityId,
  structureEntityId,
  takerArmy,
  allowReverse,
}: TroopsProps) => {
  const {
    setup: {
      account: { account },
      components: { Army, Protector },
      systemCalls: { army_merge_troops, create_army },
      network: { world },
    },
  } = useDojo();

  const { getArmy } = getArmyByEntityId();

  const maxTroopCountPerArmy = configManager.getTroopConfig().maxTroopCount;

  const [loading, setLoading] = useState<boolean>(false);

  const [troopsGiven, setTroopsGiven] = useState<Record<number, bigint>>({
    [ResourcesIds.Crossbowman]: 0n,
    [ResourcesIds.Knight]: 0n,
    [ResourcesIds.Paladin]: 0n,
  });

  const protector = useComponentValue(Protector, getEntityIdFromKeys([BigInt(structureEntityId || 0)]));

  const protectorArmyTroops = useComponentValue(
    Army,
    getEntityIdFromKeys([BigInt(takerArmy?.entity_id || protector?.army_id || 0)]),
  )?.troops;

  const attackerArmyTroops = useComponentValue(Army, getEntityIdFromKeys([BigInt(giverArmyEntityId)]))!.troops;

  const totalTroopsReceiver = useMemo(() => {
    return (
      BigInt(Object.values(attackerArmyTroops || {}).reduce((a, b) => Number(a) + Number(b), 0)) /
      BigInt(configManager.getResourcePrecision())
    );
  }, [attackerArmyTroops]);

  // only use attackerArmyTroops because defending armies don't have troops limits
  const remainingTroops = useMemo(() => {
    const totalTroopsGiven = Object.values(troopsGiven).reduce((a, b) => a + b, 0n);
    const totalTroops = totalTroopsGiven + totalTroopsReceiver;
    return BigInt(maxTroopCountPerArmy) > totalTroops ? BigInt(maxTroopCountPerArmy) - totalTroops : 0n;
  }, [troopsGiven, totalTroopsReceiver]);

  const getMaxTroopCountForAttackingArmy = (amount: bigint, troopId: string) => {
    return Math.min(Number(amount), Number(remainingTroops) + Number(troopsGiven[Number(troopId)]));
  };

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

    const fromArmy = transferDirection === "to" ? getArmy(giverArmyEntityId) : takerArmy || getArmy(protector!.army_id);
    const toArmy = transferDirection === "to" ? takerArmy || getArmy(protector!.army_id) : getArmy(giverArmyEntityId);
    const transferedTroops = {
      knight_count: troopsGiven[ResourcesIds.Knight] * BigInt(configManager.getResourcePrecision()),
      paladin_count: troopsGiven[ResourcesIds.Paladin] * BigInt(configManager.getResourcePrecision()),
      crossbowman_count: troopsGiven[ResourcesIds.Crossbowman] * BigInt(configManager.getResourcePrecision()),
    };
    await army_merge_troops({
      signer: account,
      from_army_id: fromArmy?.entity_id ?? 0n,
      to_army_id: toArmy?.entity_id ?? 0n,
      troops: transferedTroops,
    }).then(() => {
      if (
        fromArmy &&
        !Boolean(fromArmy?.protectee) &&
        getTotalTroops(fromArmy.troops) - getTotalTroops(transferedTroops) === 0
      ) {
        world.deleteEntity(getEntityIdFromKeys([BigInt(fromArmy?.entity_id || 0)]));
      }
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

  return (
    <div className="flex flex-col">
      {transferDirection === "from" && (
        <>
          <div className="text-xs text-yellow-500 mb-2">
            ⚠️ Maximum troops per attacking army is {formatStringNumber(formatNumber(maxTroopCountPerArmy, 0))}
          </div>
          <div className="text-xs mb-2">Total troops in attacking army: {Number(totalTroopsReceiver)}</div>
        </>
      )}
      <div className="flex flex-row justify-around items-center">
        <div className="w-[60%] mr-1 bg-gold/20">
          <p className="pt-2 pb-1 text-center">{giverArmyName}</p>
          <ArmyCapacity
            army={transferDirection === "to" ? getArmy(giverArmyEntityId) : takerArmy || getArmy(protector!.army_id)}
            className="flex justify-center"
            deductedTroops={Object.values(troopsGiven).reduce((a, b) => a + b, 0n)}
          />
          {Object.entries(troopsToFormat(attackerArmyTroops)).map(([resourceId, amount]: [string, bigint]) => {
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
                      troopsGiven[Number(resourceId)] * BigInt(configManager.getResourcePrecision()) !== 0n
                        ? "text-red"
                        : ""
                    }`}
                  >
                    {transferDirection === "to"
                      ? `[${currencyFormat(
                          Number(
                            amount - troopsGiven[Number(resourceId)] * BigInt(configManager.getResourcePrecision()),
                          ),
                          0,
                        )}]`
                      : `[${currencyFormat(Number(amount), 0)}]`}
                  </p>
                </div>

                {transferDirection === "to" && (
                  <NumberInput
                    className="col-span-3 rounded-lg"
                    max={Number(amount) / configManager.getResourcePrecision()}
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
                  >{`+${troopsGiven[Number(resourceId)].toLocaleString()}`}</div>
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
            protectorArmyTroops &&
            Object.entries(troopsToFormat(protectorArmyTroops!)).map(([resourceId, amount]: [string, bigint]) => {
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
                        troopsGiven[Number(resourceId)] * BigInt(configManager.getResourcePrecision()) !== 0n
                          ? "text-red"
                          : ""
                      }`}
                    >
                      {transferDirection === "from"
                        ? `[${currencyFormat(
                            Number(
                              amount - troopsGiven[Number(resourceId)] * BigInt(configManager.getResourcePrecision()),
                            ),
                            0,
                          )}]`
                        : `[${currencyFormat(Number(amount), 0)}]`}
                    </p>
                  </div>
                  {transferDirection === "from" && (
                    <NumberInput
                      className="col-span-3 rounded-lg"
                      max={getMaxTroopCountForAttackingArmy(amount, resourceId)}
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
      {allowReverse && allowReverse === true && (
        <div className="mt-3 w-full flex justify-center">
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
      )}

      <Button
        onClick={mergeTroops}
        isLoading={loading}
        variant="primary"
        className="mt-3"
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
