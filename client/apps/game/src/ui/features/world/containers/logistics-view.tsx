import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { EntityResourceTable } from "@/ui/features/economy/resources";
import { ResourceArrivals } from "@/ui/features/economy/trading";
import { TransferAutomationAdvancedModal } from "@/ui/features/economy/transfers/transfer-automation-modal";
import { TransferAutomationPanel } from "@/ui/features/economy/transfers/transfer-automation-panel";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";

const TAB_KEYS = ["arrivals", "transfer", "automation", "balances"] as const;
type LogisticsTab = (typeof TAB_KEYS)[number];

const TAB_INDEX_BY_KEY: Record<LogisticsTab, number> = {
  arrivals: 0,
  transfer: 1,
  automation: 2,
  balances: 3,
};

const tabClass =
  "!mx-0 flex items-center justify-center rounded-md border border-gold/30 bg-black/30 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-gold transition hover:bg-gold/15";

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
            <TransferAutomationAdvancedModal embedded />
          </Tabs.Panel>
          <Tabs.Panel className="h-full overflow-y-auto">
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

const AllRealmsBalanceTab = ({ structures }: AllRealmsBalanceTabProps) => {
  const mode = useGameModeConfig();
  const [selectedId, setSelectedId] = useState<number | null>(structures[0]?.entityId ?? null);

  useEffect(() => {
    if (selectedId && structures.some((s) => s.entityId === selectedId)) return;
    setSelectedId(structures[0]?.entityId ?? null);
  }, [selectedId, structures]);

  const options = useMemo(
    () =>
      structures.map((structure) => ({
        id: structure.entityId,
        // The mode.structure.getName signature expects the Structure component value;
        // legacy callers pass the wrapper or raw value depending on context.
        name: mode.structure.getName((structure.structure ?? structure) as Parameters<typeof mode.structure.getName>[0])
          .name,
      })),
    [mode.structure, structures],
  );

  const selected = options.find((option) => option.id === selectedId) ?? options[0];

  if (!options.length) {
    return <div className="p-4 text-sm text-gold/70">No realms available.</div>;
  }

  return (
    <div className="flex gap-3 p-1">
      <div className="w-40 flex-shrink-0 space-y-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={clsx(
              "w-full rounded border px-2 py-1.5 text-left text-xs transition",
              selected?.id === option.id
                ? "border-gold/50 bg-gold/10 text-gold"
                : "border-gold/20 bg-dark/40 text-gold/80 hover:border-gold/40 hover:bg-dark/60",
            )}
            onClick={() => setSelectedId(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>
      <div className="flex-1 min-w-0 rounded-lg border border-gold/20 bg-black/40 p-2">
        {selected ? (
          <EntityResourceTable entityId={selected.id} />
        ) : (
          <div className="p-4 text-sm text-gold/70">Select a realm to view balances.</div>
        )}
      </div>
    </div>
  );
};
