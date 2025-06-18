import { useUIStore } from "@/hooks/store/use-ui-store";
import { Position } from "@/types/position";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { ViewOnMapIcon } from "@/ui/design-system/molecules/view-on-map-icon";
import { NavigateToPositionIcon } from "@/ui/features/military/components/army-chip";
import { CooldownTimer, DefenseTroop } from "@/ui/features/military/components/structure-defence";
import { TroopChip } from "@/ui/features/military/components/troop-chip";
import { currencyFormat } from "@/ui/utils/utils";
import { getBlockTimestamp } from "@/utils/timestamp";
import { getGuardsByStructure } from "@bibliothecadao/eternum";
import { useBank, useResourceManager } from "@bibliothecadao/react";
import {
  ADMIN_BANK_ENTITY_ID,
  DEFENSE_NAMES,
  ID,
  REGIONAL_BANK_FIVE_ID,
  REGIONAL_BANK_FOUR_ID,
  REGIONAL_BANK_SIX_ID,
  REGIONAL_BANK_THREE_ID,
  REGIONAL_BANK_TWO_ID,
  ResourcesIds,
} from "@bibliothecadao/types";
import { useEffect, useMemo, useState } from "react";

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
  const toggleModal = useUIStore((state) => state.toggleModal);

  return (
    <div className="grid grid-cols-4 flex-wrap justify-between items-start gap-6 rounded-xl shadow-lg panel-wood-bottom relative">
      {/* <div className="absolute top-4 right-4">
        <CircleButton
          onClick={() => {
            toggleModal(null);
            toggleModal(<HintModal initialActiveSection={"Trading"} />);
          }}
          size={"lg"}
          image={BuildingThumbs.question}
          className="hover:bg-gold/20 transition-colors duration-200"
        />
      </div> */}
      {/* <div className="col-span-12 h-full flex flex-col rounded-lg overflow-hidden">
        <BankInformationHeader />
        <div className="flex flex-col divide-y divide-gold/20">
          {BANKS.map((bank) => (
            <BankInformation key={bank.id} bank={bank} />
          ))}
        </div>
      </div> */}
    </div>
  );
};

const BankInformationHeader = () => {
  return (
    <div className="grid grid-cols-8 gap-2 py-3 px-4 bg-brown-900/80 text-gold font-medium border-b border-gold/30">
      <span className="text-sm uppercase tracking-wider">Owner</span>
      <span className="text-sm uppercase tracking-wider">Treasury</span>
      <div className="col-span-5 grid grid-cols-4 gap-2">
        {Object.values(DEFENSE_NAMES).map((name, index) => (
          <div key={index} className="flex flex-row items-center justify-center gap-1 text-sm uppercase tracking-wider">
            <div className="w-2 h-2 rounded-full bg-gold/60" />
            {name}
          </div>
        ))}
      </div>
      <div className="text-sm uppercase tracking-wider text-right pr-2">Actions</div>
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
    <div className="grid grid-cols-8 items-center py-3 px-4 hover:bg-brown-900/20 transition-colors duration-200">
      <h6 className="font-medium text-gold/90">{bankInfo?.owner || "—"}</h6>

      <div className="flex flex-row items-center gap-2">
        <span className="font-medium">{currencyFormat(Number(bankLordsBalance), 0)}</span>
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
      <div className="flex flex-row justify-end gap-3">
        <ViewOnMapIcon
          className="w-5 h-5 hover:scale-110 transition-all duration-300 text-gold/80 hover:text-gold"
          position={
            new Position({
              x: Number(bankInfo?.position.x),
              y: Number(bankInfo?.position.y),
            })
          }
        />
        <NavigateToPositionIcon
          tooltipContent="Navigate to Bank"
          position={new Position(bankInfo?.position)}
          className="text-gold/80 hover:text-gold"
        />
      </div>
    </div>
  );
};

const BankDefense = ({ maxDefenses, troops, cooldownSlots = [] }: BankDefenseProps) => {
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
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: maxDefenses }).map((_, index) => {
          const defense = defenseTroops[index];
          const slot = defense?.slot;

          return (
            <div key={slot || `empty-${index}`} className="flex justify-center">
              {cooldownSlots.includes(index) ? (
                <CooldownTimer slot={index} time={24 * 60 * 60} />
              ) : defense ? (
                <div className="relative w-full flex items-center justify-center border border-gold/40 rounded-md bg-brown-900/40 p-1 shadow-sm">
                  <TroopChip troops={defense.troops} iconSize="lg" />
                </div>
              ) : (
                <div
                  className="px-3 py-2 bg-brown-900/40 border border-gold/20 rounded-md text-gold/40 text-xs hover:border-gold/60 hover:bg-brown-900/60 transition-all flex justify-between items-center cursor-pointer w-full shadow-sm"
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
