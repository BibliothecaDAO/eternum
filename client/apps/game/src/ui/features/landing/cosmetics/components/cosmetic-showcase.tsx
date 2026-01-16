import Button from "@/ui/design-system/atoms/button";
import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { useCosmeticLoadoutStore } from "@/ui/features/landing/cosmetics/model";
import { ExternalLink } from "lucide-react";
import { CosmeticModelViewer } from "./cosmetic-model-viewer";

const TRADE_BASE_URL = "https://empire.realms.world/trade/cosmetics";

interface CosmeticShowcaseProps {
  item: CosmeticItem | null;
}

export const CosmeticShowcase = ({ item }: CosmeticShowcaseProps) => {
  const attributes = item?.attributes ?? item?.metadata?.attributes ?? [];
  const slot = item?.slot ?? attributes.find((attribute) => attribute.trait_type === "Type")?.value ?? null;

  const addCosmetic = useCosmeticLoadoutStore((state) => state.addCosmetic);
  const selectedBySlot = useCosmeticLoadoutStore((state) => state.selectedBySlot);

  const slotTokenId = slot ? selectedBySlot[slot] : undefined;
  const isEquipped = Boolean(slot && item?.tokenId && slotTokenId === item.tokenId);
  const hasSlotConflict = Boolean(slot && item?.tokenId && slotTokenId && slotTokenId !== item.tokenId);

  const canEquip = Boolean(item?.tokenId && slot);

  const handleEquipClick = () => {
    if (!canEquip || !slot || !item?.tokenId) {
      return;
    }

    addCosmetic(slot, item.tokenId);
  };

  return (
    <section className="relative z-10 flex h-full flex-col justify-between gap-6">
      <div className="relative flex-1 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-black/20 to-black/70 transition [cursor:grab] hover:border-gold/40 active:[cursor:grabbing] min-h-[320px]">
        {item ? (
          <div className="h-full w-full">
            <CosmeticModelViewer modelPath={item.modelPath} variant="showcase" autoRotate />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/60">
            Select a cosmetic to preview.
          </div>
        )}
        {item && (
          <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-black/55 px-4 py-2 backdrop-blur">
            <div className="text-xs text-white/70">
              <p className="font-semibold text-white">Owned</p>
              <p className="text-lg font-bold text-gold">{item.count ?? 1}</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-10 bottom-6 h-28 rounded-full bg-black/60 blur-3xl" />
      </div>

      <footer className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="space-y-2">
          <h3 className="text-2xl font-semibold text-white">{item?.name ?? "Select a cosmetic"}</h3>
          <p className="text-sm leading-relaxed text-white/70">
            {item?.description ?? "Highlight cosmetics to inspect materials, lighting passes, and rarity modifiers."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {slot && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span className="rounded-full border border-white/15 bg-black/40 px-3 py-1 capitalize">
                Slot: {slot.toLowerCase()}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              onClick={handleEquipClick}
              disabled={!canEquip || isEquipped}
              variant={isEquipped ? "primarySelected" : "gold"}
              forceUppercase={false}
              size="md"
            >
              {isEquipped ? "Equipped" : hasSlotConflict ? "Replace equipped cosmetic" : "Equip cosmetic"}
            </Button>

            {item?.tokenId && (
              <a
                href={`${TRADE_BASE_URL}/${item.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-black/40 px-4 text-sm text-white/70 transition hover:border-gold/50 hover:text-gold"
              >
                <ExternalLink className="h-4 w-4" />
                Trade
              </a>
            )}
          </div>

          {!canEquip && (
            <p className="text-xs text-white/50">
              On-chain cosmetics expose a token and slot before they can be assigned.
            </p>
          )}

          {hasSlotConflict && !isEquipped && slot && (
            <p className="text-xs text-amber-200">
              Selecting this will swap the active cosmetic for the {slot.toLowerCase()} slot.
            </p>
          )}
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">Attributes</h4>
            {attributes.length > 0 ? (
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {attributes.map((attribute) => (
                  <div
                    key={`${attribute.trait_type}-${attribute.value}`}
                    className="rounded-xl border border-white/10 bg-black/40 px-3 py-2"
                  >
                    <dt className="text-[0.65rem] uppercase tracking-wide text-white/40">{attribute.trait_type}</dt>
                    <dd className="text-sm font-medium text-white">{attribute.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2 text-xs text-white/50">No on-chain attribute metadata available.</p>
            )}
          </div>

        </div>
      </footer>
    </section>
  );
};
