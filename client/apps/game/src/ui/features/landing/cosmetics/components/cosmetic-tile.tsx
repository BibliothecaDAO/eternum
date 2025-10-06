import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { CosmeticModelViewer } from "./cosmetic-model-viewer";

interface CosmeticTileProps {
  item: CosmeticItem;
  active: boolean;
  onSelect: (id: string) => void;
}

export const CosmeticTile = ({ item, active, onSelect }: CosmeticTileProps) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-white/5 p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
        active ? "border-gold/80 shadow-[0_0_24px_rgba(255,215,128,0.3)]" : "border-white/10 hover:border-white/30"
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-black/40">
        <CosmeticModelViewer modelPath={item.modelPath} variant="card" autoRotate={active} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/40 opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="flex flex-col items-start text-left">
        <span className="text-sm font-medium ">{item.name}</span>
        <span className="mt-1 line-clamp-2 text-xs text-white/60">{item.description}</span>
      </div>
    </button>
  );
};
