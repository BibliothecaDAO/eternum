import { AssetType, ChestAsset, RARITY_STYLES } from "../utils/cosmetics";
import { Castle, Crown, Diamond, Hexagon, Shield, Sparkles, Sword } from "lucide-react";
import { useCallback, useRef, useState } from "react";

interface TiltCardProps {
  asset: ChestAsset;
  tiltEffect?: "normal" | "reverse";
  size?: { width: number; height: number };
  className?: string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
}

// Get icon component for each asset type
const getAssetTypeIcon = (type: AssetType) => {
  switch (type) {
    case AssetType.TroopArmor:
      return Shield;
    case AssetType.TroopPrimary:
      return Sword;
    case AssetType.TroopSecondary:
      return Shield;
    case AssetType.TroopAura:
      return Sparkles;
    case AssetType.TroopBase:
      return Hexagon;
    case AssetType.RealmSkin:
      return Castle;
    case AssetType.RealmAura:
      return Crown;
    default:
      return Diamond;
  }
};

// Hover sound
const HOVER_SOUND_SRC = "/sound/ui/ui-click-1.wav";

export function TiltCard({
  asset,
  tiltEffect = "reverse",
  size = { width: 280, height: 360 },
  className = "",
  onMouseEnter,
  onMouseLeave,
  onClick,
}: TiltCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [tiltValues, setTiltValues] = useState({
    rX: 0,
    rY: 0,
    bX: 50,
    bY: 80,
  });

  const rarityStyle = RARITY_STYLES[asset.rarity];
  const TypeIcon = getAssetTypeIcon(asset.type);

  // Play hover sound
  const playHoverSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(HOVER_SOUND_SRC);
      audioRef.current.volume = 0.2;
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const offsetX = event.clientX - rect.left;
      const offsetY = event.clientY - rect.top;

      let X: number;
      let Y: number;

      if (tiltEffect === "reverse") {
        X = (offsetX - size.width / 2) / 3 / 3;
        Y = -(offsetY - size.height / 2) / 3 / 3;
      } else {
        X = -(offsetX - size.width / 2) / 3 / 3;
        Y = (offsetY - size.height / 2) / 3 / 3;
      }

      setTiltValues({
        rX: Y,
        rY: X,
        bX: 50 - Y / 4,
        bY: 80 - X / 4,
      });
    },
    [size.width, size.height, tiltEffect],
  );

  const handleMouseEnter = useCallback(() => {
    setIsActive(true);
    playHoverSound();
    onMouseEnter?.();
  }, [onMouseEnter, playHoverSound]);

  const handleMouseLeave = useCallback(() => {
    setIsActive(false);
    setTiltValues({ rX: 0, rY: 0, bX: 50, bY: 80 });
    onMouseLeave?.();
  }, [onMouseLeave]);

  // Use imagePath directly - it's now a full URL from IPFS
  const imagePath = asset.imagePath;

  return (
    <div
      className={`cursor-pointer ${className}`}
      style={{
        transformStyle: "preserve-3d",
        perspective: "1000px",
        width: size.width,
        height: size.height,
        // Prevent overflow from 3D transforms
        contain: "layout",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
    >
      <div
        ref={containerRef}
        className={`
          relative w-full h-full rounded-2xl overflow-hidden
          ${rarityStyle.glow}
          ${isActive ? "" : "transition-transform duration-500"}
        `}
        style={{
          transform: `rotateX(${tiltValues.rX}deg) rotateY(${tiltValues.rY}deg)`,
          transformStyle: "preserve-3d",
          willChange: isActive ? "transform" : "auto",
        }}
      >
        {/* Background image with parallax effect */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${imagePath})`,
            backgroundPosition: `${tiltValues.bX}% ${tiltValues.bY}%`,
            backgroundSize: "120% auto",
            transition: isActive ? "none" : "background-position 0.5s ease-out",
          }}
        />

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

        {/* Corner decorations */}
        <div
          className={`
            absolute top-3 right-3 w-4 h-4 border-t border-r
            ${rarityStyle.border}
            opacity-50 transition-all duration-300
            ${isActive ? "w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]" : ""}
          `}
        />
        <div
          className={`
            absolute bottom-3 left-3 w-4 h-4 border-b border-l
            ${rarityStyle.border}
            opacity-50 transition-all duration-300
            ${isActive ? "w-[calc(100%-1.5rem)] h-[calc(100%-1.5rem)]" : ""}
          `}
        />

        {/* Rarity badge - top left */}
        <div className="absolute top-4 left-4 z-10">
          <span
            className={`${rarityStyle.bg} text-white capitalize font-bold px-3 py-1 rounded-md text-xs inline-flex items-center`}
          >
            {asset.rarity}
          </span>
        </div>

        {/* Content area - bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5" style={{ transform: "translateZ(20px)" }}>
          {/* Type icon and badge */}
          <div className="flex items-center gap-2 mb-2">
            <TypeIcon className={`w-4 h-4 ${rarityStyle.text}`} />
            <span className="text-xs text-white/70 uppercase tracking-wider">{asset.type}</span>
          </div>

          {/* Asset name */}
          <h3 className="text-xl font-bold text-white mb-2 leading-tight">{asset.name}</h3>

          {/* Set name */}
          {asset.set && <p className="text-sm text-white/50">{asset.set}</p>}

          {/* Troop type if applicable */}
          {asset.troopType && <p className="text-xs text-white/40 mt-1">For: {asset.troopType}</p>}
        </div>

        {/* Shine effect on hover */}
        {isActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(
                ${135 + tiltValues.rY * 2}deg,
                transparent 40%,
                rgba(255, 255, 255, 0.1) 50%,
                transparent 60%
              )`,
            }}
          />
        )}
      </div>
    </div>
  );
}

// Smaller variant for selection grids
export function TiltCardMini({
  asset,
  selected = false,
  onClick,
}: {
  asset: ChestAsset;
  selected?: boolean;
  onClick?: () => void;
}) {
  const rarityStyle = RARITY_STYLES[asset.rarity];

  // Use imagePath directly - it's now a full URL from IPFS
  const imagePath = asset.imagePath;

  return (
    <div
      className={`
        relative w-20 h-24 rounded-lg overflow-hidden cursor-pointer
        transition-all duration-200 hover:scale-105
        ${selected ? `ring-2 ${rarityStyle.border} scale-105` : ""}
        ${rarityStyle.glow}
      `}
      onClick={onClick}
    >
      <img src={imagePath} alt={asset.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute bottom-1 left-1 right-1">
        <p className="text-[10px] text-white truncate font-medium">{asset.name}</p>
      </div>
    </div>
  );
}
