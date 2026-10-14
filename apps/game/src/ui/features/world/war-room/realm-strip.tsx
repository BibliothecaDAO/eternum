import { cn } from "@/ui/design-system/atoms/lib/utils";
import { OVERLAY_SURFACE_BASE } from "@/ui/design-system/atoms/overlay-surface";
import { formatInventoryAmount } from "@/ui/features/world/components/entities/compact-entity-inventory";
import { useStructureEntityDetail } from "@/ui/features/world/components/entities/hooks/use-structure-entity-detail";
import { useStocks } from "./realm-stocks";
import { useRealmList } from "./realm-rows";

const STRIP_STOCKS = 3;

/**
 * The phone's selected realm at the foot of the map: its name, which opens the Realm sheet, the previous and next
 * realm, and its first three stocks.
 */
export const RealmStrip = ({ onOpen }: { onOpen: () => void }) => {
  const { realms, selected, select } = useRealmList();
  if (!selected) return null;
  const index = realms.findIndex((realm) => realm.entityId === selected.entityId);
  const step = (by: number) => select(realms[(index + by + realms.length) % realms.length].entityId);
  return (
    <section
      aria-label="Selected realm"
      className={cn(OVERLAY_SURFACE_BASE, "pointer-events-auto flex flex-col gap-1.5 rounded-xl px-3 py-2")}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-h-11 min-w-0 truncate text-left text-lg font-semibold text-kit-cream"
        >
          {selected.displayName}
        </button>
        {realms.length > 1 && index >= 0 && (
          <span className="flex shrink-0 gap-1">
            <StepButton label="Previous realm" onClick={() => step(-1)}>
              ‹
            </StepButton>
            <StepButton label="Next realm" onClick={() => step(1)}>
              ›
            </StepButton>
          </span>
        )}
      </div>
      <StripStocks structureEntityId={selected.entityId} />
    </section>
  );
};

const StepButton = ({ label, onClick, children }: { label: string; onClick: () => void; children: string }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    className="h-11 w-11 rounded-lg border border-kit-line2 text-xl text-kit-cream active:bg-gold/15"
  >
    {children}
  </button>
);

const StripStocks = ({ structureEntityId }: { structureEntityId: number }) => {
  const { resources } = useStructureEntityDetail({ structureEntityId });
  const { summary } = useStocks(resources);
  return (
    <dl className="grid grid-cols-3 gap-2">
      {summary.slice(0, STRIP_STOCKS).map((stock) => (
        <div key={stock.resourceId} className="flex flex-col">
          <dt className="truncate text-sm text-kit-muted">{stock.name}</dt>
          <dd className="text-base font-semibold tabular-nums text-kit-cream">{formatInventoryAmount(stock.amount)}</dd>
        </div>
      ))}
    </dl>
  );
};
