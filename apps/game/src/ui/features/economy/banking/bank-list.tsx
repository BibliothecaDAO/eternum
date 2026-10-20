import { HudTabs } from "@/ui/design-system/kit/hud-elements";
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
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <HudTabs tabs={BANK_TABS.map((each) => ({ key: each.key, label: each.label }))} value={tab} onChange={setTab} />
      {tab === "swap" ? (
        <ResourceSwap entityId={structureEntityId} listResourceId={selectedResource} />
      ) : (
        <AddLiquidity entityId={structureEntityId} listResourceId={selectedResource} />
      )}
      <div className="flex-1 overflow-y-auto border-t border-hud-divider pt-3">
        <LiquidityTable entity_id={structureEntityId} />
      </div>
    </div>
  );
};
