import { useUIStore } from "@/hooks/store/use-ui-store";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { EntityResourceTable } from "@/ui/features/economy/resources";
import { ResourceArrivals } from "@/ui/features/economy/trading";
import { TransferAutomationAdvancedModal } from "@/ui/features/economy/transfers/transfer-automation-modal";
import { TransferAutomationPanel } from "@/ui/features/economy/transfers/transfer-automation-panel";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { HUD_BODY_MUTED } from "@/ui/design-system/atoms/hud-typography";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { StructureSidebar } from "@/ui/features/world/containers/structure-sidebar";

const TAB_KEYS = ["arrivals", "transfer", "automation", "balances"] as const;
type LogisticsTab = (typeof TAB_KEYS)[number];

const TAB_INDEX_BY_KEY: Record<LogisticsTab, number> = {
  arrivals: 0,
  transfer: 1,
  automation: 2,
  balances: 3,
};

const tabClass =
  "!mx-0 flex items-center justify-center rounded-md border border-gold/20 bg-black/25 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-gold/75 transition hover:border-gold/40 hover:text-gold";

interface LogisticsViewProps {
  hasArrivals: boolean;
}

/**
 * LogisticsView — unified replacement for the old "Resource Arrivals" sidebar
 * view and the centered "Transfers" modal. Renders inside the FloatingViewPanel
 * with four tabs: Arrivals · Transfer · Automation · All Balances.
 *
 * The initially-selected tab comes from useUIStore.logisticsActiveTab so
 * external triggers (e.g., WalletPill's swap chip) can open the panel directly
 * to a specific tab.
 */
export const LogisticsView = ({ hasArrivals }: LogisticsViewProps) => {
  const activeTabKey = useUIStore((state) => state.logisticsActiveTab);
  const setActiveTabKey = useUIStore((state) => state.setLogisticsActiveTab);
  const transferPanelSourceId = useUIStore((state) => state.transferPanelSourceId);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const arrivedArrivalsNumber = useUIStore((state) => state.arrivedArrivalsNumber);
  const pendingArrivalsNumber = useUIStore((state) => state.pendingArrivalsNumber);

  const selectedIndex = TAB_INDEX_BY_KEY[activeTabKey];
  const totalArrivals = arrivedArrivalsNumber + pendingArrivalsNumber;
  // Ready-to-claim is more urgent (green) than still-in-flight (gold); pick the
  // tone that better matches what's actually waiting.
  const badgeTone = arrivedArrivalsNumber > 0 ? "bg-progress-bar-good/90 text-dark" : "bg-gold/90 text-dark";

  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <Tabs
        selectedIndex={selectedIndex}
        onChange={(index) => setActiveTabKey(TAB_KEYS[index] ?? "arrivals")}
        className="flex flex-1 flex-col gap-2 min-h-0"
      >
        <Tabs.List className="grid grid-cols-4 gap-1">
          <Tabs.Tab className={tabClass}>
            <span className="inline-flex items-center gap-1.5">
              Arrivals
              {totalArrivals > 0 && (
                <span
                  className={clsx(
                    "inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums",
                    badgeTone,
                  )}
                  title={`${arrivedArrivalsNumber} ready · ${pendingArrivalsNumber} pending`}
                >
                  {totalArrivals}
                </span>
              )}
            </span>
          </Tabs.Tab>
          <Tabs.Tab className={tabClass}>Transfer</Tabs.Tab>
          <Tabs.Tab className={tabClass}>Automation</Tabs.Tab>
          <Tabs.Tab className={tabClass}>Balances</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panels className="flex-1 min-h-0 overflow-hidden">
          <Tabs.Panel className="h-full overflow-y-auto">
            <ResourceArrivals hasArrivals={hasArrivals} />
          </Tabs.Panel>
          <Tabs.Panel className="h-full overflow-y-auto">
            <TransferAutomationPanel initialSourceId={transferPanelSourceId ?? undefined} />
          </Tabs.Panel>
          <Tabs.Panel className="h-full overflow-y-auto">
            <TransferAutomationAdvancedModal />
          </Tabs.Panel>
          <Tabs.Panel className="h-full overflow-hidden">
            <AllRealmsBalanceTab structures={playerStructures} />
          </Tabs.Panel>
        </Tabs.Panels>
      </Tabs>
    </div>
  );
};

interface AllRealmsBalanceTabProps {
  structures: Array<{ entityId: number; structure?: unknown }>;
}

/** The balances tab: the shared structure switcher on the left, the chosen structure's balances on the right. */
const AllRealmsBalanceTab = ({ structures }: AllRealmsBalanceTabProps) => {
  const [selectedId, setSelectedId] = useState<number | null>(structures[0]?.entityId ?? null);

  useEffect(() => {
    if (selectedId && structures.some((s) => s.entityId === selectedId)) return;
    setSelectedId(structures[0]?.entityId ?? null);
  }, [selectedId, structures]);

  if (!structures.length) {
    return <p className={cn(HUD_BODY_MUTED, "p-4")}>No structures yet.</p>;
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-12">
      <div className="col-span-3 min-h-0 border-r border-gold/15">
        <StructureSidebar
          selectedEntityId={selectedId ?? 0}
          onSelectStructure={setSelectedId}
          title="Your structures"
          enableCategoryFilter
        />
      </div>
      <div className="col-span-9 min-h-0 overflow-y-auto px-3 py-2">
        {selectedId ? (
          <EntityResourceTable entityId={selectedId} />
        ) : (
          <p className={HUD_BODY_MUTED}>Select a structure.</p>
        )}
      </div>
    </div>
  );
};
