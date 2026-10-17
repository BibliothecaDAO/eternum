import { HudTabStrip } from "@/ui/design-system/molecules/hud-tab-strip";
import AddLiquidity from "./add-liquidity";
import { LiquidityTable } from "./liquidity-table";
import { ResourceSwap } from "./swap";
import { ID } from "@bibliothecadao/types";
import { useState } from "react";

type BankListProps = {
  structureEntityId: ID;
  selectedResource: number;
};

const BANK_TABS = [
  { key: "swap", label: "Swap" },
  { key: "pools", label: "Pools" },
] as const;
type BankTab = (typeof BANK_TABS)[number]["key"];

export const BankPanel = ({ structureEntityId, selectedResource }: BankListProps) => {
  const [tab, setTab] = useState<BankTab>("swap");

  return (
    <div className="amm-selector flex min-h-0 flex-1 flex-col px-3 py-2">
      <HudTabStrip tabs={BANK_TABS} selected={tab} onSelect={setTab} className="pb-2" />
      {tab === "swap" ? (
        <ResourceSwap entityId={structureEntityId} listResourceId={selectedResource} />
      ) : (
        <AddLiquidity entityId={structureEntityId} listResourceId={selectedResource} />
      )}
      <div className="mt-3 flex-1 overflow-y-auto border-t border-gold/15 pt-3 text-xs">
        <LiquidityTable entity_id={structureEntityId} />
      </div>
    </div>
  );
};
