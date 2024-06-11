import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo } from "@/hooks/helpers/useArmies";
import { FullStructure, Structure, useStructuresPosition } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { CombatTarget } from "@/types";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, Position, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  const { formattedRealmAtPosition, formattedStructureAtPosition } = useStructuresPosition({ position });
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
      const target = formattedStructureAtPosition || formattedRealmAtPosition;
      return (
        ownArmySelected && (
          <Button
            variant="primary"
            onClick={() =>
              setBattleView({
                ownArmy: ownArmySelected,
                opponentEntity: { type: CombatTarget.Structure, entity: target as unknown as FullStructure },
              })
            }
          >
            Combat
          </Button>
        )
      );
    }
  }, [formattedRealmAtPosition, formattedStructureAtPosition, ownArmySelected]);

  return (
    Boolean(formattedStructureAtPosition) && (
      <div>
        <Headline className="my-3">Structure</Headline>

        <div className="flex">
          {!showMergeTroopsPopup && formattedRealmAtPosition && (
            <RealmListItem realm={formattedRealmAtPosition} extraButton={button} />
          )}
          {!showMergeTroopsPopup && !formattedRealmAtPosition && formattedStructureAtPosition && (
            <StructureListItem structure={formattedStructureAtPosition} extraButton={button} />
          )}
          {showMergeTroopsPopup && (
            <div className="flex flex-col w-[100%]">
              <Button
                className="mb-3 w-[30%]"
                variant="default"
                size="xs"
                onClick={() => setShowMergeTroopsPopup(false)}
              >
                &lt; Back
              </Button>

              <MergeTroopsPanel
                giverArmy={ownArmySelected!}
                structure={formattedRealmAtPosition || formattedStructureAtPosition}
              />
            </div>
          )}
        </div>
      </div>
    )
  );
};

const MergeTroopsPanel = ({ giverArmy, structure }: MergeTroopsPanelProps) => {
  const {
    setup: {
      account: { account },
      components: { Protector },
      systemCalls: { create_army },
    },
  } = useDojo();

  const protector = useComponentValue(Protector, getEntityIdFromKeys([BigInt(structure.entity_id!)]));

  useEffect(() => {
    const createProtector = async () => {
      await create_army({
        signer: account,
        army_is_protector: true,
        army_owner_id: structure.entity_id!,
      });
    };

    if (protector) return;
    createProtector();
  }, [protector]);

  return (
    protector && (
      <div className="flex flex-col clip-angled-sm bg-gold/20 p-3">
        <Headline>Reinforce {structure.name}'s troops</Headline>
        <TroopExchange giverArmyEntityId={BigInt(giverArmy.entity_id)} takerArmyEntityId={BigInt(protector.army_id)} />
      </div>
    )
  );
};

type TroopsProps = {
  giverArmyEntityId: bigint;
  takerArmyEntityId: bigint;
};

const troopsToFormat = (troops: { knight_count: number; paladin_count: number; crossbowman_count: number }) => {
  return {
    [ResourcesIds.Crossbowmen]: troops.crossbowman_count,
    [ResourcesIds.Knight]: troops.knight_count,
    [ResourcesIds.Paladin]: troops.paladin_count,
  };
};

const TroopExchange = ({ giverArmyEntityId, takerArmyEntityId }: TroopsProps) => {
  const [troopsGiven, setTroopsGiven] = useState<Record<number, number>>({
    [ResourcesIds.Crossbowmen]: 0,
    [ResourcesIds.Knight]: 0,
    [ResourcesIds.Paladin]: 0,
  });
  const {
    setup: {
      account: { account },
      components: { Army },
      systemCalls: { army_merge_troops },
    },
  } = useDojo();

  const [loading, setLoading] = useState<boolean>(false);

  const [transferDirection, setTransferDirection] = useState<"to" | "from">("to");

  const mergeTroops = async () => {
    setLoading(true);
    await army_merge_troops({
      signer: account,
      from_army_id: transferDirection === "to" ? giverArmyEntityId : takerArmyEntityId,
      to_army_id: transferDirection === "to" ? takerArmyEntityId : giverArmyEntityId,
      troops: {
        knight_count: troopsGiven[ResourcesIds.Knight] * EternumGlobalConfig.resources.resourceMultiplier,
        paladin_count: troopsGiven[ResourcesIds.Paladin] * EternumGlobalConfig.resources.resourceMultiplier,
        crossbowman_count: troopsGiven[ResourcesIds.Crossbowmen] * EternumGlobalConfig.resources.resourceMultiplier,
      },
    });
    setLoading(false);
    setTroopsGiven({
      [ResourcesIds.Crossbowmen]: 0,
      [ResourcesIds.Knight]: 0,
      [ResourcesIds.Paladin]: 0,
    });
  };

  const handleTroopsGivenChange = (resourceId: string, amount: number) => {
    setTroopsGiven((prev) => ({ ...prev, [resourceId]: amount }));
  };

  const giverArmyTroops = useComponentValue(Army, getEntityIdFromKeys([giverArmyEntityId]))!.troops;
  const receiverArmyTroops = useComponentValue(Army, getEntityIdFromKeys([takerArmyEntityId]))!.troops;

  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-around items-center">
        <div className="w-[40%]">
          <p className="pt-2 pb-5">Current Army</p>
          {Object.entries(troopsToFormat(giverArmyTroops)).map(([resourceId, amount]: [string, number]) => {
            return (
              <div
                className="flex flex-row bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-16 gap-4"
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
                            amount - troopsGiven[Number(resourceId)] * EternumGlobalConfig.resources.resourceMultiplier,
                            0,
                          )}]`
                        : `[${currencyFormat(amount, 0)}]` + ` +${troopsGiven[Number(resourceId)]}`}
                    </p>
                  </div>
                </div>

                {transferDirection === "to" && (
                  <NumberInput
                    className="w-1/2"
                    max={amount / EternumGlobalConfig.resources.resourceMultiplier}
                    min={0}
                    step={100}
                    value={troopsGiven[Number(resourceId)]}
                    onChange={(amount) => handleTroopsGivenChange(resourceId, amount)}
                  />
                )}
              </div>
            );
          })}
        </div>
        <Button
          onClick={() => {
            setTransferDirection(transferDirection === "to" ? "from" : "to");
          }}
        >
          <ArrowRight className={`${transferDirection === "to" ? "" : "rotate-180"} duration-300`} />
        </Button>

        <div className="w-[40%]">
          <p className=" pt-2 pb-5">Transfer {transferDirection} Structure</p>
          {Object.entries(troopsToFormat(receiverArmyTroops)).map(([resourceId, amount]: [string, number]) => {
            return (
              <div
                className="flex flex-row bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-16 gap-4"
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
                            amount - troopsGiven[Number(resourceId)] * EternumGlobalConfig.resources.resourceMultiplier,
                            0,
                          )}]`
                        : `[${currencyFormat(amount, 0)}]` + ` +${troopsGiven[Number(resourceId)]}`}
                    </p>
                  </div>
                </div>
                {transferDirection === "from" && (
                  <NumberInput
                    className="w-1/2"
                    max={amount / EternumGlobalConfig.resources.resourceMultiplier}
                    min={0}
                    step={100}
                    value={troopsGiven[Number(resourceId)]}
                    onChange={(amount) => handleTroopsGivenChange(resourceId, amount)}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Button
        onClick={mergeTroops}
        isLoading={loading}
        className="mt-5"
        disabled={Object.values(troopsGiven).every((amount) => amount === 0)}
      >
        Reinforce
      </Button>
    </div>
  );
};

type MergeTroopsPanelProps = {
  giverArmy: ArmyInfo;
  structure: Structure;
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
