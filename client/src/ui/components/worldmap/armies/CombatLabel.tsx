import { useDojo } from "@/hooks/context/DojoContext";
import useUIStore from "@/hooks/store/useUIStore";
import Button from "@/ui/elements/Button";
import { DojoHtml } from "@/ui/elements/DojoHtml";
import { getComponentValue } from "@dojoengine/recs";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Position } from "@/ui/elements/BaseThreeTooltip";
import { Headline } from "@/ui/elements/Headline";
import { useComponentValue } from "@dojoengine/react";
import { currencyFormat } from "@/ui/utils/utils";
import { EternumGlobalConfig, ResourcesIds, U32_MAX } from "@bibliothecadao/eternum";
import { ResourceIcon } from "@/ui/elements/ResourceIcon";
import { NumberInput } from "@/ui/elements/NumberInput";
import { ArrowRight } from "lucide-react";

interface ArmyInfoLabelProps {
  structureEntityId?: bigint;
  defenderEntityId?: bigint;
  attackerEntityId: bigint;
  isTargetMine: boolean;
}

export const CombatLabel = ({
  defenderEntityId,
  attackerEntityId,
  structureEntityId,
  isTargetMine,
}: ArmyInfoLabelProps) => {
  const [showMergeTroopsPopup, setShowMergeTroopsPopup] = useState<boolean>(false);
  const {
    setup: {
      components: { Protector },
    },
  } = useDojo();

  const setBattleView = useUIStore((state) => state.setBattleView);

  const attackedArmyId = useMemo(() => {
    if (defenderEntityId) {
      return defenderEntityId;
    }
    if (structureEntityId) {
      const attackedArmy = getComponentValue(Protector, getEntityIdFromKeys([BigInt(structureEntityId)]));
      return attackedArmy?.army_id;
    }
  }, [isTargetMine, structureEntityId, defenderEntityId, attackerEntityId]);

  const protect = async () => {
    setShowMergeTroopsPopup(true);
  };

  const attack = () => {
    setBattleView({
      attackerId: attackerEntityId,
      defenderId: BigInt(attackedArmyId || 0n),
      structure: BigInt(structureEntityId || 0n),
    });
  };

  return (
    <DojoHtml className="relative -left-[15px] -top-[70px]">
      {!showMergeTroopsPopup &&
        (structureEntityId && isTargetMine ? (
          <Button variant="primary" onClick={protect}>
            Protect
          </Button>
        ) : (
          <Button variant="primary" onClick={attack}>
            Attack
          </Button>
        ))}
      {showMergeTroopsPopup && (
        <MergeTroopsPanel giverArmyEntityId={attackerEntityId} structureEntityId={structureEntityId!} />
      )}
    </DojoHtml>
  );
};

type MergeTroopsPanelProps = {
  giverArmyEntityId: bigint;
  structureEntityId: bigint;
};

const MergeTroopsPanel = ({ giverArmyEntityId, structureEntityId }: MergeTroopsPanelProps) => {
  const {
    setup: {
      account: { account },
      components: { Protector },
      systemCalls: { create_army },
    },
  } = useDojo();

  const protector = useComponentValue(Protector, getEntityIdFromKeys([BigInt(structureEntityId!)]));

  useEffect(() => {
    const createProtector = async () => {
      await create_army({
        signer: account,
        army_is_protector: true,
        army_owner_id: structureEntityId!,
      });
    };

    if (protector) return;
    createProtector();
  }, [protector]);

  return (
    protector && (
      <ToolTip>
        <Headline>Reinforce troops</Headline>
        <TroopExchange giverArmyEntityId={giverArmyEntityId} takerArmyEntityId={protector.army_id}></TroopExchange>
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

  const mergeTroops = async () => {
    await army_merge_troops({
      signer: account,
      from_army_id: giverArmyEntityId,
      to_army_id: takerArmyEntityId,
      troops: {
        knight_count: troopsGiven[ResourcesIds.Knight] * EternumGlobalConfig.resources.resourceMultiplier,
        paladin_count: troopsGiven[ResourcesIds.Paladin] * EternumGlobalConfig.resources.resourceMultiplier,
        crossbowman_count: troopsGiven[ResourcesIds.Crossbowmen] * EternumGlobalConfig.resources.resourceMultiplier,
      },
    });
  };

  const handleTroopsGivenChange = (resourceId: string, amount: number) => {
    setTroopsGiven((prev) => ({ ...prev, [resourceId]: amount }));
  };

  const giverArmyTroops = troopsToFormat(getComponentValue(Army, getEntityIdFromKeys([giverArmyEntityId]))!.troops);
  const receiverArmyTroops = troopsToFormat(getComponentValue(Army, getEntityIdFromKeys([takerArmyEntityId]))!.troops);
  return (
    <div className="flex flex-col">
      <div className="flex flex-row justify-around items-center">
        <div className="w-[40%]">
          <p className="pt-2 pb-5">Your Army</p>
          {Object.entries(giverArmyTroops).map(([resourceId, amount]: [string, number]) => {
            console.log(amount - troopsGiven[Number(resourceId)]);
            return (
              <div
                className="flex flex-row p-2 bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-[5vh]"
                key={resourceId}
              >
                <Troop troopId={Number(resourceId)} amount={amount} />
                <NumberInput
                  className="w-[50%]"
                  max={amount / EternumGlobalConfig.resources.resourceMultiplier}
                  min={0}
                  step={100}
                  value={troopsGiven[Number(resourceId)]}
                  onChange={(amount) => handleTroopsGivenChange(resourceId, amount)}
                />
                <div className="w-[30px] flex flex-col text-xs font-bold">
                  <p>Avail.</p>
                  <p>
                    [
                    {currencyFormat(
                      amount - troopsGiven[Number(resourceId)] * EternumGlobalConfig.resources.resourceMultiplier,
                      0,
                    )}
                    ]
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <ArrowRight></ArrowRight>
        <div className="w-[40%]">
          <p className=" pt-2 pb-5">Structure</p>
          {Object.entries(receiverArmyTroops).map(([resourceId, amount]: [string, number]) => {
            return (
              <div
                className="flex flex-row p-2 bg-gold/20 clip-angled-sm hover:bg-gold/30 justify-around items-center h-[5vh]"
                key={resourceId}
              >
                <Troop troopId={Number(resourceId)} amount={amount} />
                <div className="w-[30px] flex flex-col text-xs font-bold">
                  <p>Total</p>
                  <p>
                    [
                    {currencyFormat(
                      amount + troopsGiven[Number(resourceId)] * EternumGlobalConfig.resources.resourceMultiplier,
                      0,
                    )}
                    ]
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Button
        onClick={mergeTroops}
        className="mt-5"
        disabled={Object.values(troopsGiven).every((amount) => amount === 0)}
      >
        Reinforce
      </Button>
    </div>
  );
};

const Troop = ({ troopId, amount }: { troopId: number; amount: number }) => {
  const [showName, setShowName] = useState<boolean>(false);
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
      <div className="bg-white/10 clip-angled-sm flex justify-between">
        <ResourceIcon withTooltip={false} resource={ResourcesIds[troopId]} size="lg" />
      </div>
    </div>
  );
};
