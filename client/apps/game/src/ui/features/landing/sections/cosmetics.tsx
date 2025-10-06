import { CosmeticGallery, CosmeticShowcase } from "@/ui/features/landing/cosmetics/components";
import { COSMETIC_ITEMS, type CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { useMemo, useState } from "react";

export const LandingCosmetics = () => {
  const [selectedId, setSelectedId] = useState<string | null>(COSMETIC_ITEMS[0]?.id ?? null);

  const selectedItem = useMemo<CosmeticItem | null>(() => {
    if (!selectedId) return null;
    return COSMETIC_ITEMS.find((item) => item.id === selectedId) ?? null;
  }, [selectedId]);

  return (
    <section className="flex w-full flex-col gap-6 xl:flex-row container  h-[70vh]">
      <div className="w-full xl:w-1/2 rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur panel-wood overflow-y-auto">
        <CosmeticGallery items={COSMETIC_ITEMS} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      <aside className="w-full rounded-3xl panel-wood border-white/10 bg-black/70 p-6 backdrop-blur xl:w-1/2 xl:min-w-[26rem]">
        <CosmeticShowcase item={selectedItem} />
      </aside>
    </section>
  );
};
