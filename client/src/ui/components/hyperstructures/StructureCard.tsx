import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { Realm, Structure, useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { RealmListItem } from "../worldmap/realms/RealmListItem";
import { StructureListItem } from "../worldmap/structures/StructureListItem";

export const StructureCard = ({
  position,
  ownArmySelected,
}: {
  position: Position;
  ownArmySelected: ArmyInfo | undefined;
}) => {
  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);
  const { useFormattedRealmAtPosition, useFormattedStructureAtPosition } = useStructuresPosition({ position });

  const formattedRealmAtPosition = useFormattedRealmAtPosition();
  const formattedStructureAtPosition = useFormattedStructureAtPosition();

  const setBattleView = useUIStore((state) => state.setBattleView);

  const button = useMemo(() => {
    if (
      (formattedRealmAtPosition && formattedRealmAtPosition.self) ||
      (formattedStructureAtPosition && formattedStructureAtPosition.isMine)
    ) {
      return (
        ownArmySelected && (
          <Button variant="primary" onClick={() => setShowMergeTroopsPopup(true)}>
            Protect
          </Button>
        )
      );
    } else if (
      (formattedRealmAtPosition && !formattedRealmAtPosition.self) ||
      (formattedStructureAtPosition && !formattedStructureAtPosition.isMine)
    ) {
      const target = Boolean(formattedRealmAtPosition) ? formattedRealmAtPosition : formattedStructureAtPosition;
      return (
        ownArmySelected && (
          <Button
            variant="primary"
            onClick={() =>
              setBattleView({
                battle: undefined,
                target: { type: CombatTarget.Structure, entity: target as Realm | Structure },
              })
            }
          >
            Combat
          </Button>
        )
      );
    }
  }, [formattedRealmAtPosition, formattedStructureAtPosition, ownArmySelected]);

  const target = formattedStructureAtPosition || formattedRealmAtPosition;

  return (
    Boolean(formattedStructureAtPosition) && (
      <div className="h-full flex flex-col justify-center">
        {!showMergeTroopsPopup && formattedRealmAtPosition && (
          <RealmListItem realm={formattedRealmAtPosition} extraButton={button} />
        )}
        {!showMergeTroopsPopup && !formattedRealmAtPosition && formattedStructureAtPosition && (
          <StructureListItem structure={formattedStructureAtPosition} extraButton={button} />
        )}
        {showMergeTroopsPopup && (
          <div className="flex flex-col w-[100%]">
            {ownArmySelected && (
              <MergeTroopsPanel
                giverArmy={ownArmySelected}
                setShowMergeTroopsPopup={setShowMergeTroopsPopup}
                structureEntityId={BigInt(target!.entity_id)}
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
  setShowMergeTroopsPopup: (val: boolean) => void;
  structureEntityId: bigint;
};

const MergeTroopsPanel = ({ giverArmy, setShowMergeTroopsPopup, structureEntityId }: MergeTroopsPanelProps) => {
  return (
    <div className="flex flex-col clip-angled-sm bg-gold/20 p-3 max-h-[42vh] overflow-y-auto">
      <Button className="mb-3 w-[30%]" variant="default" size="xs" onClick={() => setShowMergeTroopsPopup(false)}>
        &lt; Back
      </Button>
      <TroopExchange
        giverArmy={giverArmy}
        giverArmyEntityId={BigInt(giverArmy.entity_id)}
        structureEntityId={structureEntityId}
      />
    </div>
  );
};

type TroopsProps = {
  giverArmy: ArmyInfo;
  giverArmyEntityId: bigint;
  structureEntityId: bigint;
};

const troopsToFormat = (troops: { knight_count: bigint; paladin_count: bigint; crossbowman_count: bigint }) => {
  return {
    [ResourcesIds.Crossbowman]: troops.crossbowman_count,
    [ResourcesIds.Knight]: troops.knight_count,
    [ResourcesIds.Paladin]: troops.paladin_count,
  };
};

const TroopExchange = ({ giverArmy, giverArmyEntityId, structureEntityId }: TroopsProps) => {
  const [troopsGiven, setTroopsGiven] = useState<Record<number, bigint>>({
    [ResourcesIds.Crossbowman]: 0n,
    [ResourcesIds.Knight]: 0n,
    [ResourcesIds.Paladin]: 0n,
  });

  const {
    setup: {
      account: { account },
      components: { Army, Protector },
      systemCalls: { army_merge_troops, create_army },
    },
  } = useDojo();

  const protector = useComponentValue(Protector, getEntityIdFromKeys([structureEntityId]));

  const createProtector = async () => {
    await create_army({
      signer: account,
      is_defensive_army: true,
      army_owner_id: structureEntityId,
    });
  };

  const [loading, setLoading] = useState<boolean>(false);

  const [transferDirection, setTransferDirection] = useState<"to" | "from">("to");

  const mergeTroops = async () => {
    setLoading(true);
    await army_merge_troops({
      signer: account,
      from_army_id: transferDirection === "to" ? giverArmyEntityId : protector!.army_id,
      to_army_id: transferDirection === "to" ? protector!.army_id : giverArmyEntityId,
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

  const giverArmyTroops = useComponentValue(Army, getEntityIdFromKeys([giverArmyEntityId]))!.troops;
  const receiverArmyTroops = useComponentValue(Army, getEntityIdFromKeys([protector?.army_id || 0n]))?.troops;

  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-around items-center">
        <div className="w-[60%] mr-1">
          <p className="pt-2 pb-1 text-center">{giverArmy.name}</p>
          {Object.entries(troopsToFormat(giverArmyTroops)).map(([resourceId, amount]: [string, bigint]) => {
            return (
              <div
                className="flex flex-row bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-12 gap-4 px-4 mb-1"
                key={resourceId}
              >
                <div className=" flex gap-3">
                  <div>
                    <Troop troopId={Number(resourceId)} />
                  </div>

                  <div className=" flex flex-col text-xs font-bold">
                    <p>Avail.</p>
                    <p>
                      {transferDirection === "to"
                        ? `[${currencyFormat(
                            amount -
                              troopsGiven[Number(resourceId)] *
                                BigInt(EternumGlobalConfig.resources.resourceMultiplier),
                            0,
                          )}]`
                        : `[${currencyFormat(amount, 0)}]` + ` +${troopsGiven[Number(resourceId)]}`}
                    </p>
                  </div>
                </div>

                {transferDirection === "to" && (
                  <NumberInput
                    className="w-1/2"
                    max={Number(amount) / EternumGlobalConfig.resources.resourceMultiplier}
                    min={0}
                    step={100}
                    value={Number(troopsGiven[Number(resourceId)])}
                    onChange={(amount) => handleTroopsGivenChange(resourceId, BigInt(amount))}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="w-[60%] ml-1">
          <p className="pt-2 pb-1 text-center">Transfer {transferDirection} Structure</p>
          {!protector ? (
            <Button variant={"primary"} onClick={createProtector}>
              Create defending army
            </Button>
          ) : (
            receiverArmyTroops &&
            Object.entries(troopsToFormat(receiverArmyTroops!)).map(([resourceId, amount]: [string, bigint]) => {
              return (
                <div
                  className="flex flex-row bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-12 gap-4 px-4 mb-1"
                  key={resourceId}
                >
                  <div className=" flex gap-3">
                    <div>
                      <Troop troopId={Number(resourceId)} />
                    </div>

                    <div className="flex flex-col text-xs font-bold">
                      <p>Avail.</p>
                      <p>
                        {transferDirection === "from"
                          ? `[${currencyFormat(
                              amount -
                                troopsGiven[Number(resourceId)] *
                                  BigInt(EternumGlobalConfig.resources.resourceMultiplier),
                              0,
                            )}]`
                          : `[${currencyFormat(amount, 0)}]` + ` +${troopsGiven[Number(resourceId)]}`}
                      </p>
                    </div>
                  </div>
                  {transferDirection === "from" && (
                    <NumberInput
                      className="w-1/2"
                      max={Number(amount) / EternumGlobalConfig.resources.resourceMultiplier}
                      min={0}
                      step={100}
                      value={Number(troopsGiven[Number(resourceId)])}
                      onChange={(amount) => handleTroopsGivenChange(resourceId, BigInt(amount))}
                    />
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
        disabled={Object.values(troopsGiven).every((amount) => amount === 0n) || !protector}
      >
        Reinforce
      </Button>
    </div>
  );
};

const Troop = ({ troopId }: { troopId: number }) => {
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
      className="flex flex-col font-bold"
    >
      <div className="bg-white/10 clip-angled-sm flex justify-between p-1">
        <ResourceIcon withTooltip={false} resource={ResourcesIds[troopId]} size="lg" />
      </div>
    </div>
  );
};
