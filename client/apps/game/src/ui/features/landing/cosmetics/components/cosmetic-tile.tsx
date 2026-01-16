import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { useCosmeticLoadoutStore } from "@/ui/features/landing/cosmetics/model";
import { ExternalLink } from "lucide-react";

const TRADE_BASE_URL = "https://empire.realms.world/trade/cosmetics";

interface CosmeticTileProps {
  item: CosmeticItem;
  active: boolean;
  onSelect: (id: string) => void;
}

export const CosmeticTile = ({ item, active, onSelect }: CosmeticTileProps) => {
  const attributes = item.attributes ?? item.metadata?.attributes ?? [];
  const rarity = attributes.find((attribute) => attribute.trait_type === "Rarity")?.value;
  const cosmeticType = attributes.find((attribute) => attribute.trait_type === "Type")?.value;
  const slotKey = item.slot ?? cosmeticType ?? null;
  const isEquipped = useCosmeticLoadoutStore((state) => {
    if (!slotKey || !item.tokenId) {
      return false;
    }
    return state.selectedBySlot[slotKey] === item.tokenId;
  });

  const baseClass =
    "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border bg-gold/5 p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  const activeClass = active
    ? "border-gold/80 shadow-[0_0_24px_rgba(255,215,128,0.3)]"
    : "border-gold/10 hover:border-gold/30";
  const equippedClass = isEquipped
    ? "border-gold/60 shadow-[0_0_30px_rgba(250,204,21,0.25)] after:pointer-events-none after:absolute after:inset-0 after:content-[''] after:bg-[radial-gradient(circle_at_top,#facc15_0%,transparent_60%)] after:opacity-70"
    : "";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className={`${baseClass} ${activeClass} ${equippedClass}`}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-black/40">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gold/30">No image</div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/40 opacity-0 transition group-hover:opacity-100" />
        {isEquipped && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full border border-gold/80 bg-black/70 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-gold shadow-[0_0_12px_rgba(250,204,21,0.45)]">
            Equipped
          </div>
        )}
        {/* Count badge - shows how many of this cosmetic type you own */}
        {item.count && item.count > 1 && (
          <div className="pointer-events-none absolute left-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-gold/30 bg-black/80 text-xs font-bold text-gold shadow-lg">
            {item.count}
          </div>
        )}
        {/* Trade link - appears on hover */}
        {item.tokenId && (
          <a
            href={`${TRADE_BASE_URL}/${item.tokenId}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full border border-gold/20 bg-black/80 text-gold/70 opacity-0 transition-all hover:border-gold/60 hover:bg-black hover:text-gold group-hover:opacity-100"
            title="Trade on Empire"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="flex flex-col items-start text-left">
        <span className="text-sm font-medium text-gold">{item.name}</span>
        <span className="mt-1 line-clamp-2 text-xs text-gold/60">{item.description}</span>
        <div className="mt-3 flex flex-wrap gap-2 text-[0.65rem] text-gold/70">
          {rarity && (
            <span className="rounded-full border border-gold/20 bg-black/40 px-2 py-0.5 uppercase tracking-wide">
              {rarity}
            </span>
          )}
          {cosmeticType && (
            <span className="rounded-full border border-gold/20 bg-black/40 px-2 py-0.5 capitalize">
              {cosmeticType.toLowerCase()}
            </span>
          )}
          {item.tokenSymbol && (
            <span className="rounded-full border border-gold/20 bg-black/40 px-2 py-0.5 uppercase tracking-wide">
              {item.tokenSymbol}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};
