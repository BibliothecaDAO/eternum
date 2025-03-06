import { useModalStore } from "@/hooks/store/use-modal-store";
import { Position } from "@/types/position";
import { BuildingThumbs } from "@/ui/config";
import CircleButton from "@/ui/elements/circle-button";
import { ResourceIcon } from "@/ui/elements/resource-icon";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import {
  ADMIN_BANK_ENTITY_ID,
  getGuardsByStructure,
  ID,
  REGIONAL_BANK_FIVE_ID,
  REGIONAL_BANK_FOUR_ID,
  REGIONAL_BANK_SIX_ID,
  REGIONAL_BANK_THREE_ID,
  REGIONAL_BANK_TWO_ID,
  ResourcesIds,
} from "@bibliothecadao/eternum";
import { useBank, useResourceManager } from "@bibliothecadao/react";
import { useEffect, useMemo, useState } from "react";
import { HintModal } from "../hints/hint-modal";
import { NavigateToPositionIcon } from "../military/army-chip";
import { ViewOnMapIcon } from "../military/army-management-card";
import { CooldownTimer, DEFENSE_NAMES, DefenseTroop } from "../military/structure-defence";
import { TroopChip } from "../military/troop-chip";

type Bank = {
  id: ID;
  position: string;
};

interface BankDefenseProps {
  maxDefenses: number; // 1-4
  troops: DefenseTroop[];
  cooldownSlots?: number[]; // Slots with active cooldown [1, 4]
}

const BANKS: Bank[] = [
  { id: Number(ADMIN_BANK_ENTITY_ID), position: "N" },
  { id: Number(REGIONAL_BANK_TWO_ID), position: "NE" },
  { id: Number(REGIONAL_BANK_THREE_ID), position: "NW" },
  { id: Number(REGIONAL_BANK_FOUR_ID), position: "S" },
  { id: Number(REGIONAL_BANK_FIVE_ID), position: "SE" },
  { id: Number(REGIONAL_BANK_SIX_ID), position: "SW" },
];

export const MarketHeader = () => {
  const { toggleModal } = useModalStore();

  return (
    <div className="grid grid-cols-4 p-3 flex-wrap justify-between items-start gap-6 mb-8 rounded-xl shadow-lg border border-gold/20 relative">
      <div className="self-center flex-grow max-w-2xl mx-auto">
        <h3 className="text-5xl font-extrabold mb-1">The Lords Market</h3>
        <div className="flex flex-row">
          <p className="text-xs">
            Engage in direct player-to-player trades through the orderbook, leverage the AMM for bank liquidity trades,
            or boost your earnings by providing liquidity to the bank.
          </p>
        </div>
      </div>
      <div className="absolute top-4 left-4">
        <CircleButton
          onClick={() => {
            toggleModal(null);
            toggleModal(<HintModal initialActiveSection={"Trading"} />);
          }}
          size={"lg"}
          image={BuildingThumbs.question}
          className="hover:bg-gold/20 transition-colors duration-200"
        />
      </div>
      <div className="col-span-3 bg-brown p-3 rounded-xl text-sm shadow-lg border border-gold/30 h-full flex flex-col">
        <BankInformationHeader />
        {BANKS.map((bank) => (
          <BankInformation key={bank.id} bank={bank} />
        ))}
      </div>
    </div>
  );
};

const BankInformationHeader = () => {
  return (
    <div className="grid grid-cols-8 gap-2 text-gold/80 text-xs font-medium border-b border-gold/20 mb-1">
      <span>Owner</span>

      <span>Treasury</span>
      <div className="col-span-5 grid grid-cols-4 gap-2">
        {Object.values(DEFENSE_NAMES).map((name, index) => (
          <div key={index} className="flex flex-row items-center justify-center gap-1">
            <div className="w-1 h-1 rounded-full bg-gold/40" />
            {name}
          </div>
        ))}
      </div>
      <div></div>
    </div>
  );
};

const BankInformation = ({ bank }: { bank: Bank }) => {
  const bankInfo = useBank(bank.id);

  const bankResourceManager = useResourceManager(bankInfo?.entityId || 0);

  const bankLordsBalance = useMemo(
    () => Number(bankResourceManager.balanceWithProduction(getBlockTimestamp().currentDefaultTick, ResourcesIds.Lords)),
    [bankResourceManager],
  );

  const guards = getGuardsByStructure(bankInfo?.structure);

  return (
    <div className="grid grid-cols-8 gap-2 items-center mb-1">
      <span>{bankInfo?.owner}</span>

      <div className="flex flex-row items-center">
        <span>{currencyFormat(Number(bankLordsBalance), 0)}</span>
        <ResourceIcon className={"mt-0.5"} resource={ResourcesIds[ResourcesIds.Lords]} size="sm" />
      </div>
      <div className="col-span-5">
        <BankDefense
          maxDefenses={bankInfo?.structure.base.troop_max_guard_count}
          troops={guards.map((army) => ({
            slot: army.slot,
            troops: army.troops,
          }))}
        />
      </div>
      <div className="flex flex-row justify-end gap-2">
        <ViewOnMapIcon
          className="w-5 h-5 hover:scale-110 transition-all duration-300"
          position={
            new Position({
              x: Number(bankInfo?.position.x),
              y: Number(bankInfo?.position.y),
            })
          }
        />
        <NavigateToPositionIcon tooltipContent="Navigate to Bank" position={new Position(bankInfo?.position)} />
      </div>
    </div>
  );
};

export const BankDefense = ({ maxDefenses, troops, cooldownSlots = [] }: BankDefenseProps) => {
  const [defenseTroops, setDefenseTroops] = useState(troops);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  useEffect(() => {
    setDefenseTroops(troops);
  }, [troops]);

  const toggleDefenseExpansion = (index: number) => {
    setExpandedSlot(expandedSlot === index ? null : index);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: maxDefenses }).map((_, index) => {
          const defense = defenseTroops[index];
          const slot = defense?.slot;

          return (
            <div key={slot || `empty-${index}`} className="flex justify-center">
              {cooldownSlots.includes(index) ? (
                <CooldownTimer slot={index} time={24 * 60 * 60} />
              ) : defense ? (
                <div className="relative">
                  <TroopChip troops={defense.troops} iconSize="sm" className="hover:border-gold/40 transition-colors" />
                </div>
              ) : (
                <div
                  className="px-3 py-2 bg-brown-900/50 border border-gold/20 rounded-md text-gold/40 text-xs hover:border-gold/40 transition-colors flex justify-between items-center cursor-pointer w-full"
                  onClick={() => toggleDefenseExpansion(index)}
                >
                  <span>Empty</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
