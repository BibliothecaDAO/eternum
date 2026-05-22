import { TRANSFER_POPUP_NAME } from "@/ui/features/economy/transfers/transfer-automation-popup";
import { useCurrentDefaultTick } from "@/hooks/helpers/use-block-timestamp";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { useGameModeConfig } from "@/config/game-modes/use-game-mode-config";
import { Pill } from "@/ui/design-system/molecules/pill";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import {
  buildDisplayItems,
  CompactEntityInventory,
} from "@/ui/features/world/components/entities/compact-entity-inventory";
import { useDojo } from "@bibliothecadao/react";
import { EntityType, RelicRecipientType, ResourcesIds } from "@bibliothecadao/types";
import { useComponentValue } from "@dojoengine/react";
import { getEntityIdFromKeys } from "@dojoengine/utils";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const HERO_COUNT = 3;

const compactInventoryFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const formatHeroAmount = (value: number): string => {
  const floored = Math.floor(value);
  if (floored >= 1000) return compactInventoryFormatter.format(floored);
  return floored.toLocaleString();
};

/**
 * WalletPill — top-zone pill exposing the active structure's resource balance.
 *
 * The same Resource component drives the in-panel Balance card in
 * RealmInfoPanel; both surfaces coexist while we validate this is the new
 * canonical access path. Clicking the pill opens a popover with the full
 * inventory grid plus the transfer shortcut.
 */
export const WalletPill = memo(() => {
  const structureEntityId = useUIStore((state) => state.structureEntityId);
  const setTransferPanelSourceId = useUIStore((state) => state.setTransferPanelSourceId);
  const openPopup = useUIStore((state) => state.openPopup);
  const isTransferPopupOpen = useUIStore((state) => state.isPopupOpen(TRANSFER_POPUP_NAME));
  const { setup } = useDojo();
  const components = setup.components;
  const mode = useGameModeConfig();
  const currentDefaultTick = useCurrentDefaultTick();

  const resourceEntityKey = useMemo(() => {
    if (!structureEntityId) return undefined;
    try {
      return getEntityIdFromKeys([BigInt(structureEntityId)]);
    } catch {
      return undefined;
    }
  }, [structureEntityId]);

  const resources = useComponentValue(components.Resource, resourceEntityKey);

  const resourceTiers = useMemo(() => mode.resources.getTiers(), [mode]);
  // Guard against pre-sync / spectate states where the default tick can be Infinity.
  // buildDisplayItems forwards the tick into BigInt(...) inside the core balance math,
  // which throws RangeError on non-finite values.
  const items = useMemo(() => {
    if (!resources || !Number.isFinite(currentDefaultTick)) return [];
    try {
      return buildDisplayItems(resources, currentDefaultTick, [], RelicRecipientType.Structure, resourceTiers);
    } catch (error) {
      console.warn("[WalletPill] buildDisplayItems failed", error);
      return [];
    }
  }, [resources, currentDefaultTick, resourceTiers]);

  const heroItems = useMemo(() => items.slice(0, HERO_COUNT), [items]);

  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || !wrapperRef.current) return;
      if (!wrapperRef.current.contains(target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [isOpen]);

  const handleOpenTransfer = useCallback(() => {
    if (!structureEntityId) return;
    setTransferPanelSourceId(structureEntityId);
    if (!isTransferPopupOpen) {
      openPopup(TRANSFER_POPUP_NAME);
    }
    setIsOpen(false);
  }, [isTransferPopupOpen, openPopup, setTransferPanelSourceId, structureEntityId]);

  // Don't render a pill when there's nothing to show. A structure with no balance
  // would surface an empty pill — pure noise. Also skips when no structure is
  // active (spectator without a selected target, fresh load before sync, etc.).
  if (!structureEntityId || items.length === 0) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <Pill
        tone="default"
        active={isOpen}
        className="gap-2 normal-case tracking-normal text-xs"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open wallet"
        title="View balance"
      >
        <span className="flex items-center gap-2">
          {heroItems.map((item) => (
            <span key={item.resourceId} className="flex items-center gap-1">
              <ResourceIcon
                resource={ResourcesIds[item.resourceId]}
                size="xs"
                withTooltip={false}
              />
              <span className="font-semibold leading-none text-gold/95">{formatHeroAmount(item.amount)}</span>
            </span>
          ))}
          <ChevronDown
            className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")}
            aria-hidden="true"
          />
        </span>
      </Pill>

      {isOpen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[340px] panel-wood panel-wood-corners rounded-lg border border-gold/20 bg-black/90 p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xxs uppercase tracking-[0.2em] text-gold/60">Balance</span>
            <button
              type="button"
              onClick={handleOpenTransfer}
              disabled={!structureEntityId}
              className={cn(
                "flex items-center gap-1 rounded-full border border-gold/30 bg-black/40 px-2.5 py-1 text-xxs font-semibold text-gold/80 transition",
                !structureEntityId && "cursor-not-allowed opacity-50",
                structureEntityId && "hover:bg-gold/10 hover:text-gold",
              )}
              aria-label="Open transfer panel"
              title="Open transfer panel"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>
          <CompactEntityInventory
            resources={resources}
            recipientType={RelicRecipientType.Structure}
            entityId={structureEntityId ?? undefined}
            entityType={EntityType.STRUCTURE}
            variant="tight"
            showLabels={false}
            maxItems={14}
            heroCount={HERO_COUNT}
          />
        </div>
      )}
    </div>
  );
});

WalletPill.displayName = "WalletPill";
