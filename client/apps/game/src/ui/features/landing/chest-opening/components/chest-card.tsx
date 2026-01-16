import Button from "@/ui/design-system/atoms/button";
import gsap from "gsap";
import { Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MergedNftData } from "../utils/types";

export interface ChestCardProps {
  chest: MergedNftData;
  onSelect?: () => void;
  onOpen?: () => void;
  isSelected?: boolean;
  isLoading?: boolean;
  index?: number;
}

export function ChestCard({
  chest,
  onSelect,
  onOpen,
  isSelected = false,
  isLoading = false,
  index = 0,
}: ChestCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = useState(false);

  // Transform IPFS URLs to use Pinata gateway
  const image = chest.metadata?.image?.startsWith("ipfs://")
    ? chest.metadata.image.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")
    : chest.metadata?.image;

  // GSAP hover animations
  useEffect(() => {
    if (!cardRef.current) return;

    const card = cardRef.current;

    const handleMouseEnter = () => {
      gsap.to(card, {
        scale: 1.05,
        y: -8,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    const handleMouseLeave = () => {
      gsap.to(card, {
        scale: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
      });
    };

    card.addEventListener("mouseenter", handleMouseEnter);
    card.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      card.removeEventListener("mouseenter", handleMouseEnter);
      card.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  // Entry animation
  useEffect(() => {
    if (!cardRef.current) return;

    gsap.fromTo(
      cardRef.current,
      {
        opacity: 0,
        y: 30,
        scale: 0.9,
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.4,
        delay: index * 0.1,
        ease: "back.out(1.4)",
      },
    );
  }, [index]);

  const handleClick = () => {
    if (onSelect) {
      onSelect();
    }
  };

  const handleOpenClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onOpen) {
      onOpen();
    }
  };

  return (
    <div
      ref={cardRef}
      className={`
        relative rounded-xl overflow-hidden
        transition-shadow duration-200
        ${onSelect ? "cursor-pointer" : ""}
        ${isSelected ? "ring-2 ring-gold shadow-xl shadow-gold/20" : "shadow-lg hover:shadow-xl"}
        ${isLoading && isSelected ? "pointer-events-none" : ""}
      `}
      onClick={handleClick}
    >
      {/* Chest image */}
      <div className="aspect-square bg-slate-900 relative">
        {image && !imageError ? (
          <img
            src={image}
            alt={`Chest #${chest.token_id}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-16 h-16" />
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && isSelected && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && !isLoading && (
          <div className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center">
            <span className="text-background text-sm font-bold">✓</span>
          </div>
        )}
      </div>

      {/* Chest info */}
      <div className="p-3 bg-slate-800">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-white">#{chest.token_id}</span>
        </div>
        {/* Show key attributes from metadata */}
        {chest.metadata?.attributes && chest.metadata.attributes.length > 0 && (
          <div className="space-y-0.5">
            {chest.metadata.attributes.slice(0, 3).map((attr, idx) => (
              <div key={idx} className="text-xs text-white/50 truncate">
                <span className="text-white/70">{attr.trait_type}:</span> {attr.value}
              </div>
            ))}
          </div>
        )}

        {/* Open button */}
        {onOpen && (
          <Button
            onClick={handleOpenClick}
            variant="gold"
            size="xs"
            className="mt-3 w-full"
            disabled={isLoading}
          >
            {isLoading ? "Opening..." : "Open Chest"}
          </Button>
        )}
      </div>

      {/* Glow effect */}
      <div className="absolute inset-0 pointer-events-none rounded-xl opacity-20 border border-gold/30" />
    </div>
  );
}
