import { CosmeticItem } from "@/ui/features/landing/cosmetics/config/cosmetics.data";
import { CosmeticTile } from "./cosmetic-tile";

interface CosmeticGalleryProps {
  items: CosmeticItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const CosmeticGallery = ({ items, selectedId, onSelect }: CosmeticGalleryProps) => {
  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3">
        {items.map((item) => (
          <CosmeticTile key={item.id} item={item} active={item.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
};
