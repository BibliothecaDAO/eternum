import { ClientComponents } from "@/dojo/createClientComponents";
import {
  BattleManager,
  BattleStartStatus,
  ClaimStatus,
  LeaveStatus,
  RaidStatus,
} from "@/dojo/modelManager/BattleManager";
import { useDojo } from "@/hooks/context/DojoContext";
import { ArmyInfo, getArmyByEntityId } from "@/hooks/helpers/useArmies";
import { Structure } from "@/hooks/helpers/useStructures";
import { useModalStore } from "@/hooks/store/useModalStore";
import useUIStore from "@/hooks/store/useUIStore";
import { ModalContainer } from "@/ui/components/ModalContainer";
import { PillageHistory } from "@/ui/components/military/PillageHistory";
import Button from "@/ui/elements/Button";
import { Headline } from "@/ui/elements/Headline";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/elements/Select";
import { ID, WORLD_CONFIG_ID } from "@bibliothecadao/eternum";
import { ComponentValue, getComponentValue } from "@dojoengine/recs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeftView } from "../../navigation/LeftNavigationModule";

import { ReactComponent as Battle } from "@/assets/icons/battle.svg";
import { ReactComponent as Burn } from "@/assets/icons/burn.svg";
import { ReactComponent as Castle } from "@/assets/icons/castle.svg";
import { ReactComponent as Flag } from "@/assets/icons/flag.svg";
import useNextBlockTimestamp from "@/hooks/useNextBlockTimestamp";
import { currencyFormat } from "@/ui/utils/utils";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import { getChancesOfSuccess, getMaxResourceAmountStolen, getTroopLossOnRaid } from "./utils";

enum Loading {
  None,
  Claim,
  Raid,
  Start,
  Leave,
}

export const BattleActions = ({
  battleManager,
  userArmiesInBattle,
  ownArmyEntityId,
  attackerArmies,
  defenderArmies,
  structure,
  battleAdjusted,
}: {
  battleManager: BattleManager;
  userArmiesInBattle: ArmyInfo[];
  ownArmyEntityId: ID | undefined;
  attackerArmies: (ArmyInfo | undefined)[];
  defenderArmies: (ArmyInfo | undefined)[];
  structure: Structure | undefined;
  battleAdjusted: ComponentValue<ClientComponents["Battle"]["schema"]> | undefined;
}) => {
  const dojo = useDojo();
  const {
    account: { account },
    setup: {
      components: { TroopConfig },
      systemCalls: { battle_leave, battle_start, battle_claim, battle_leave_and_claim, battle_force_start },
    },
  } = dojo;

  const { toggleModal } = useModalStore();
  const { getAliveArmy } = getArmyByEntityId();

  const setTooltip = useUIStore((state) => state.setTooltip);
  const { nextBlockTimestamp: currentTimestamp, currentArmiesTick } = useNextBlockTimestamp();
  const setBattleView = useUIStore((state) => state.setBattleView);
  const setView = useUIStore((state) => state.setLeftNavigationView);

  const [loading, setLoading] = useState<Loading>(Loading.None);
  const [raidWarning, setRaidWarning] = useState(false);
  const [localSelectedUnit, setLocalSelectedUnit] = useState<ID | undefined>(ownArmyEntityId ?? 0);

  useEffect(() => {
    if (localSelectedUnit === 0 || !userArmiesInBattle.some((army) => army.entity_id === localSelectedUnit)) {
      const newLocalSelectedUnit = userArmiesInBattle?.[0]?.entity_id ?? ownArmyEntityId;
      setLocalSelectedUnit(newLocalSelectedUnit);
    }
  }, [userArmiesInBattle, ownArmyEntityId]);

  const isActive = useMemo(() => battleManager.isBattleOngoing(currentTimestamp!), [battleManager, currentTimestamp]);

  const selectedArmy = useMemo(() => {
    return getAliveArmy(localSelectedUnit || 0);
  }, [localSelectedUnit, isActive, userArmiesInBattle]);

  const defenderArmy = useMemo(() => {
    const defender = structure?.protector ?? defenderArmies[0];

    const battleManager = new BattleManager(defender?.battle_id || battleAdjusted?.entity_id || 0, dojo);
    return battleManager.getUpdatedArmy(defender, battleManager.getUpdatedBattle(currentTimestamp!));
  }, [defenderArmies, localSelectedUnit, isActive, currentTimestamp, battleAdjusted]);

  const handleRaid = async () => {
    if (selectedArmy?.battle_id !== 0 && !raidWarning) {
      setRaidWarning(true);
      return;
    }

    setLoading(Loading.Raid);
    setRaidWarning(false);
    try {
      await battleManager.pillageStructure(selectedArmy!, structure!.entity_id);
      toggleModal(
        <ModalContainer size="half">
          <Headline>Pillage History</Headline>
          <PillageHistory structureId={structure!.entity_id} />
        </ModalContainer>,
      );
      setBattleView(null);
      setView(LeftView.None);
    } catch (error) {
      console.error("Error during pillage:", error);
    }
    setLoading(Loading.None);
  };

  const handleBattleStart = async () => {
    setLoading(Loading.Start);

    try {
      if (battleStartStatus === BattleStartStatus.ForceStart) {
        await battle_force_start({
          signer: account,
          battle_id: battleManager?.battleEntityId || 0,
          defending_army_id: defenderArmy!.entity_id,
        });
      } else {
        await battle_start({
          signer: account,
          attacking_army_id: selectedArmy!.entity_id,
          defending_army_id: defenderArmy!.entity_id,
        });
      }
      setBattleView({
        engage: false,
        battleEntityId: undefined,
        ownArmyEntityId: undefined,
        targetArmy: defenderArmy?.entity_id,
      });
    } catch (error) {
      console.error("Error during battle start:", error);
    }
    setLoading(Loading.None);
  };

  const handleBattleClaim = async () => {
    setLoading(Loading.Claim);
    try {
      if (battleAdjusted?.entity_id! !== 0 && battleAdjusted?.entity_id === selectedArmy!.battle_id) {
        await battle_leave_and_claim({
          signer: account,
          army_id: selectedArmy!.entity_id,
          battle_id: battleManager?.battleEntityId || 0,
          structure_id: structure!.entity_id,
        });
      } else {
        await battle_claim({
          signer: account,
          army_id: selectedArmy!.entity_id,
          structure_id: structure!.entity_id,
        });
      }
    } catch (error) {
      console.error("Error during claim:", error);
    }
    setBattleView(null);
    setView(LeftView.None);

    setLoading(Loading.None);
  };

  const handleLeaveBattle = async () => {
    setLoading(Loading.Leave);
    await battle_leave({
      signer: account,
      army_ids: [selectedArmy!.entity_id],
      battle_id: battleManager?.battleEntityId || 0,
    }).then(() => {
      const attackerArmiesLength = attackerArmies.some((army) => army?.entity_id === selectedArmy?.entity_id)
        ? attackerArmies.length - 1
        : attackerArmies.length;
      const defenderArmiesLength = defenderArmies.some((army) => army?.entity_id === selectedArmy?.entity_id)
        ? defenderArmies.length - 1
        : defenderArmies.length;
      if (attackerArmiesLength === 0 && defenderArmiesLength === 0) {
        battleManager.deleteBattle();
      }
    });
    setLoading(Loading.None);
    setBattleView(null);
    setView(LeftView.None);
  };

  const claimStatus = useMemo(
    () => battleManager.isClaimable(currentTimestamp!, selectedArmy, structure, defenderArmy),
    [battleManager, currentTimestamp, selectedArmy, structure, defenderArmy],
  );

  const raidStatus = useMemo(
    () => battleManager.isRaidable(currentTimestamp!, currentArmiesTick, selectedArmy, structure),
    [battleManager, currentTimestamp, selectedArmy, structure, currentArmiesTick],
  );

  const battleStartStatus = useMemo(
    () => battleManager.isAttackable(selectedArmy, defenderArmy, currentTimestamp!),
    [battleManager, defenderArmy, currentTimestamp, selectedArmy],
  );

  const leaveStatus = useMemo(
    () => battleManager.isLeavable(currentTimestamp!, selectedArmy),
    [currentTimestamp, battleManager, selectedArmy],
  );

  const mouseEnterRaid = useCallback(() => {
    const troopConfig = getComponentValue(TroopConfig, getEntityIdFromKeys([WORLD_CONFIG_ID]));
    if (!troopConfig) return 0;

    const raidSuccessPercentage = getChancesOfSuccess(selectedArmy, defenderArmy, troopConfig) * 100;

    const maxResourceAmountStolen = getMaxResourceAmountStolen(selectedArmy, defenderArmy, troopConfig);
    const [attackerTroopsLoss, defenseTroopsLoss] = getTroopLossOnRaid(selectedArmy, defenderArmy, troopConfig);
    let content = [
      <div key="title" className="text-xs font-bold text-center">
        Raid outcome:
      </div>,
      <div key="attacker-loss" className="flex justify-between py-1">
        <span>Your troops loss:</span>
        <span className="font-medium text-red">{currencyFormat(Number(attackerTroopsLoss), 0)}</span>
      </div>,
      <div key="defender-loss" className="flex justify-between py-1">
        <span>Defender troops loss:</span>
        <span className="font-medium text-red">{currencyFormat(Number(defenseTroopsLoss), 0)}</span>
      </div>,
      <div key="success-chance" className="flex justify-between py-1">
        <span>Success chance:</span>
        <span className="font-medium text-green">{raidSuccessPercentage.toFixed(2)}%</span>
      </div>,
      <div key="max-resources" className="flex justify-between py-1">
        <span>Max resources stolen:</span>
        <span className="font-medium">{maxResourceAmountStolen}</span>
      </div>,
    ];

    if (raidStatus !== RaidStatus.isRaidable) {
      setTooltip({ content: <div className="">{raidStatus}</div>, position: "top" });
    } else if (selectedArmy?.battle_id !== 0) {
      content.push(<div>Raiding will make you leave and lose 25% of your army</div>);
    }

    setTooltip({
      content: <div className="w-[250px]">{content}</div>,
      position: "top",
    });
  }, [raidStatus, selectedArmy, defenderArmy]);

  const mouseEnterLeave = useCallback(() => {
    if (leaveStatus !== LeaveStatus.Leave) {
      setTooltip({ content: <div>{leaveStatus}</div>, position: "top" });
    }
  }, [leaveStatus]);

  const mouseEnterBattle = useCallback(() => {
    if (battleStartStatus !== BattleStartStatus.BattleStart && battleStartStatus !== BattleStartStatus.ForceStart) {
      setTooltip({ content: <div>{battleStartStatus}</div>, position: "top" });
    }
  }, [battleStartStatus]);

  const mouseEnterClaim = useCallback(() => {
    if (claimStatus !== ClaimStatus.Claimable) {
      setTooltip({ content: <div>{claimStatus}</div>, position: "top" });
    }
  }, [claimStatus]);

  return (
    <div className="col-span-2 flex justify-center flex-wrap -bottom-y p-2 my-10 ">
      <div className="grid grid-cols-2 gap-4 w-full">
        <div
          className={`flex flex-col gap-2 h-full w-full bg-[#FF621F] rounded-xl border-red/30 ${
            loading !== Loading.None || raidStatus !== RaidStatus.isRaidable ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onMouseEnter={mouseEnterRaid}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            variant="outline"
            className="flex flex-col gap-2 h-full border-0 justify-center"
            isLoading={loading === Loading.Raid}
            onClick={handleRaid}
            disabled={loading !== Loading.None || raidStatus !== RaidStatus.isRaidable}
          >
            <Burn className="w-12 h-12" />

            <div className={`text-wrap text-xl text-white/80 ${raidWarning ? "text-danger" : ""}`}>
              {raidWarning ? "Leave & Raid ?" : "Raid"}
            </div>
          </Button>
        </div>
        <div
          className={`flex flex-col gap-2 h-full w-full bg-[#377D5B] rounded-xl border-[#377D5B] ${
            loading !== Loading.None || claimStatus !== ClaimStatus.Claimable ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onMouseEnter={mouseEnterClaim}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            variant="outline"
            className="flex flex-col gap-2 h-full border-0 justify-center"
            isLoading={loading === Loading.Claim}
            onClick={handleBattleClaim}
            disabled={loading !== Loading.None || claimStatus !== ClaimStatus.Claimable}
          >
            <Castle className="w-12 h-12" />
            <div className="text-xl text-white/80">Claim</div>
          </Button>
        </div>
        <div
          className={`flex flex-col gap-2 h-full w-full bg-[#483B32] rounded-xl ${
            loading !== Loading.None || leaveStatus !== LeaveStatus.Leave ? "opacity-50 cursor-not-allowed" : ""
          }`}
          onMouseEnter={mouseEnterLeave}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            variant="outline"
            className="flex flex-col gap-2 h-full border-0"
            isLoading={loading === Loading.Leave}
            onClick={handleLeaveBattle}
            disabled={loading !== Loading.None || leaveStatus !== LeaveStatus.Leave}
          >
            <Flag className="w-12 h-12" />
            <div className="text-xl text-white/80">Leave</div>
          </Button>
        </div>
        <div
          className={`flex flex-col gap-2 h-full w-full bg-[#FF1F1F] rounded-xl ${
            loading !== Loading.None ||
            (battleStartStatus !== BattleStartStatus.BattleStart && battleStartStatus !== BattleStartStatus.ForceStart)
              ? "opacity-50 cursor-not-allowed"
              : ""
          }`}
          onMouseEnter={mouseEnterBattle}
          onMouseLeave={() => setTooltip(null)}
        >
          <Button
            variant="outline"
            className="flex flex-col gap-2 h-full border-0"
            isLoading={loading === Loading.Start}
            onClick={handleBattleStart}
            disabled={
              loading !== Loading.None ||
              (battleStartStatus !== BattleStartStatus.BattleStart &&
                battleStartStatus !== BattleStartStatus.ForceStart)
            }
          >
            <Battle className="w-12 h-12" />
            <div className="text-xl text-white/80">Battle</div>
          </Button>
        </div>

        {battleAdjusted && (
          <ArmySelector
            localSelectedUnit={selectedArmy?.entity_id}
            setLocalSelectedUnit={setLocalSelectedUnit}
            userArmiesInBattle={userArmiesInBattle}
          />
        )}
      </div>
    </div>
  );
};

const ArmySelector = ({
  localSelectedUnit,
  setLocalSelectedUnit,
  userArmiesInBattle,
}: {
  localSelectedUnit: ID | undefined;
  setLocalSelectedUnit: (val: ID) => void;
  userArmiesInBattle: (ArmyInfo | undefined)[];
}) => {
  return (
    userArmiesInBattle &&
    userArmiesInBattle.length > 0 && (
      <div className="self-center w-full flex flex-col justify-between bg-transparent size-xs col-span-2 text-gold text-center border border-gold rounded h-10 font-bold text-xl">
        <Select
          onValueChange={(a: string) => {
            setLocalSelectedUnit(Number(a));
          }}
        >
          <SelectTrigger className="text-gold h-10 text-lg">
            <SelectValue
              placeholder={
                userArmiesInBattle.find((army) => localSelectedUnit === army?.entity_id || 0n)?.name || "Select army"
              }
            />
          </SelectTrigger>
          <SelectContent className="text-gold w-full">
            {userArmiesInBattle.map((army, index) => (
              <SelectItem
                className="flex justify-center self-center text-sm pl-0 w-full text-center"
                key={index}
                value={army?.entity_id?.toString() || ""}
              >
                <h5 className="gap-4 text-gold w-full max-w-full mr-2">{army?.name}</h5>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  );
};
