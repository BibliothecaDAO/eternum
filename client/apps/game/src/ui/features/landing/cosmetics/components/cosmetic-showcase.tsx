import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { CosmeticModelViewer } from "./cosmetic-model-viewer";

interface CosmeticShowcaseProps {
  item: CosmeticItem | null;
}

export const CosmeticShowcase = ({ item }: CosmeticShowcaseProps) => {
  return (
    <section className="flex h-full flex-col justify-between gap-6">
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

        <div className="pointer-events-none absolute inset-x-10 bottom-6 h-28 rounded-full bg-black/60 blur-3xl" />
      </div>

      <footer className="space-y-2">
        <h3 className="text-2xl font-semibold text-white">{item?.name ?? "Select a cosmetic"}</h3>
        <p className="text-sm leading-relaxed text-white/70">
          {item?.description ?? "Highlight cosmetics to inspect materials, lighting passes, and rarity modifiers."}
        </p>
      </footer>
    </section>
  );
};
