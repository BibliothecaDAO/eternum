import { useUIStore } from "@/hooks/store/use-ui-store";
import { SecondaryPopup } from "@/ui/design-system/molecules/secondary-popup";
import { Tabs } from "@/ui/design-system/atoms/tab";
import { EntityResourceTable } from "@/ui/features/economy/resources";
import { getIsBlitz, getStructureName } from "@bibliothecadao/eternum";
import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { TransferAutomationPanel } from "./transfer-automation-panel";
import { TransferAutomationAdvancedModal } from "./transfer-automation-modal";

export const TRANSFER_POPUP_NAME = "transfer-automation";

export const TransferAutomationPopup = () => {
  const isOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const togglePopup = useUIStore((state) => state.togglePopup);
  const sourceId = useUIStore((state) => state.transferPanelSourceId);
  const playerStructures = useUIStore((state) => state.playerStructures);
  const [selectedTab, setSelectedTab] = useState(0);

  if (!isOpen) return null;

  const handleClose = () => {
    togglePopup(TRANSFER_POPUP_NAME);
  };

  return (
    <SecondaryPopup name={TRANSFER_POPUP_NAME} className="pointer-events-auto" width="900">
      <SecondaryPopup.Head onClose={handleClose}>Transfers</SecondaryPopup.Head>
      <SecondaryPopup.Body height="auto" className="!p-2">
        <Tabs
          selectedIndex={selectedTab}
          onChange={(index: number) => setSelectedTab(index)}
          className="flex flex-col gap-1"
        >
          <Tabs.List className="grid grid-cols-3 gap-1">
            <Tabs.Tab className="!mx-0 flex items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-dark/60">
              Transfer
            </Tabs.Tab>
            <Tabs.Tab className="!mx-0 flex items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-dark/60">
              Automation
            </Tabs.Tab>
            <Tabs.Tab className="!mx-0 flex items-center justify-center rounded-lg border border-gold/30 bg-dark/40 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-gold transition hover:bg-dark/60">
              All Balances
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panels className="flex-1">
            <Tabs.Panel className="flex-1">
              <div className="p-2">
                <TransferAutomationPanel initialSourceId={sourceId ?? undefined} />
              </div>
            </Tabs.Panel>
            <Tabs.Panel className="flex-1">
              <div className="p-2">
                <TransferAutomationAdvancedModal embedded />
              </div>
            </Tabs.Panel>
            <Tabs.Panel className="flex-1">
              <div className="p-2">
                <AllRealmsBalanceTab structures={playerStructures} />
              </div>
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </SecondaryPopup.Body>
    </SecondaryPopup>
  );
};

const AllRealmsBalanceTab = ({ structures }: { structures: Array<{ entityId: number; structure?: any }> }) => {
  const isBlitz = getIsBlitz();
  const [selectedId, setSelectedId] = useState<number | null>(structures[0]?.entityId ?? null);

  useEffect(() => {
    if (selectedId && structures.some((s) => s.entityId === selectedId)) return;
    setSelectedId(structures[0]?.entityId ?? null);
  }, [selectedId, structures]);

  const options = useMemo(
    () =>
      structures.map((structure) => ({
        id: structure.entityId,
        name: getStructureName(structure.structure ?? (structure as any), isBlitz).name,
      })),
    [isBlitz, structures],
  );

  const selected = options.find((option) => option.id === selectedId) ?? options[0];

  if (!options.length) {
    return <div className="p-4 text-sm text-gold/70">No realms available.</div>;
  }

  return (
    <div className="flex gap-3">
      <div className="w-48 space-y-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={clsx(
              "w-full rounded border px-3 py-2 text-left text-sm transition",
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
      <div className="flex-1 rounded-lg border border-gold/20 bg-black/40 p-2">
        {selected ? (
          <EntityResourceTable entityId={selected.id} />
        ) : (
          <div className="p-4 text-sm text-gold/70">Select a realm to view balances.</div>
        )}
      </div>
    </div>
  );
};
