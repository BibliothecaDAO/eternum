import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyAndName, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { FullStructure, useStructures } from "@/hooks/helpers/useStructures";
import useUIStore from "@/hooks/store/useUIStore";
import { Position } from "@/ui/elements/BaseThreeTooltip";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { Headline } from "@/ui/elements/Headline";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { currencyFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds } from "@bibliothecadao/eternum";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FullArmyInfo } from "./Army";

export enum TargetType {
  Structure,
  Army,
}

interface ArmyInfoLabelProps {
  targetStructureEntityId?: bigint;
  visible?: boolean;
  targetArmy?: FullArmyInfo;
}

export const CombatLabel = ({ targetStructureEntityId, targetArmy, visible = true }: ArmyInfoLabelProps) => {
  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);

  const { getStructure } = useStructures();
  const structure = getStructure(targetStructureEntityId!);

  const { selectedEntity, setBattleView, clearSelection } = useUIStore(
    ({ selectedEntity, setBattleView, clearSelection }) => ({
      selectedEntity,
      setBattleView,
      clearSelection,
    }),
  );

  const ownArmy = useMemo(() => {
    if (!selectedEntity) {
      return;
    }
    return getArmyByEntityId(selectedEntity.id);
  }, [selectedEntity]);

  const target = useMemo(() => {
    const targetIsStructure = targetStructureEntityId !== 0n;
    const targetIsArmy = Boolean(targetArmy);
    if (!targetIsStructure && !targetIsArmy) {
      setShowMergeTroopsPopup(false);
      return;
    }
    if (targetIsStructure) {
      return { type: TargetType.Structure, entity: structure };
    } else if (targetIsArmy) {
      return { type: TargetType.Army, entity: targetArmy };
    } else {
      // should never happen
      return undefined;
    }
  }, [targetArmy, targetStructureEntityId]);

  const attack = () => {
    setBattleView({
      attacker: ownArmy!,
      target: { type: target!.type, entity: target!.entity! },
    });
    // clearSelection();
  };

  return (
    <DojoHtml visible={visible} className="relative -left-[15px] -top-[70px]">
      {target?.type === TargetType.Structure && target.entity?.isMine && !showMergeTroopsPopup && (
        <Button variant="primary" onClick={() => setShowMergeTroopsPopup(true)}>
          Protect
        </Button>
      )}
      {target?.type === TargetType.Army && !target.entity?.isMine && (
        <Button variant="primary" onClick={attack}>
          Attack Army
        </Button>
      )}
      {showMergeTroopsPopup && <MergeTroopsPanel giverArmy={ownArmy!} structure={target!.entity as FullStructure} />}
    </DojoHtml>
  );
};

type MergeTroopsPanelProps = {
  giverArmy: ArmyAndName;
  structure: FullStructure;
};

const MergeTroopsPanel = ({ giverArmy, structure }: MergeTroopsPanelProps) => {
  const {
    setup: {
      account: { account },
      components: { Protector },
      systemCalls: { create_army },
    },
  } = useDojo();

  const protector =
    structure.protector || useComponentValue(Protector, getEntityIdFromKeys([BigInt(structure.entity_id!)]));

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
      <ToolTip>
        <Headline>Reinforce troops</Headline>
        <TroopExchange
          giverArmyEntityId={BigInt(giverArmy.entity_id)}
          takerArmyEntityId={BigInt(protector.army_id)}
        ></TroopExchange>
      </ToolTip>
    )
  );
};

const ToolTip = ({ children, distanceFactor, position = Position.CENTER, className }: TooltipProps) => {
  return (
    <div className={clsx("min-w-[600px] clip-angled relative p-2 bg-brown/90 text-gold", Position.BOTTOM_RIGHT)}>
      {children}
      <svg
        className="absolute bottom-[1px] translate-y-full left-1/2 -translate-x-1/2"
        width="30"
        height="13"
        viewBox="0 0 30 13"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M15.0003 12.75L0.751603 -3.445e-06L29.249 9.53674e-07L15.0003 12.75Z" fill="fill-dark-brown" />
      </svg>
    </div>
  );
};

type TooltipProps = {
  children?: React.ReactNode;
  position?: Position;
  distanceFactor?: number;
  className?: string;
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

  // const giverArmyTroops = troopsToFormat(getComponentValue(Army, getEntityIdFromKeys([giverArmyEntityId]))!.troops);
  // const receiverArmyTroops = troopsToFormat(getComponentValue(Army, getEntityIdFromKeys([takerArmyEntityId]))!.troops);
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
                    <Troop troopId={Number(resourceId)} amount={amount} />
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
                    <Troop troopId={Number(resourceId)} amount={amount} />
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

const Troop = ({ troopId, amount }: { troopId: number; amount: number }) => {
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
