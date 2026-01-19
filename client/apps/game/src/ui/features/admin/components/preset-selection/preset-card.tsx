import { CheckCircle2, GraduationCap, Trophy, Wrench, Zap } from "lucide-react";
import type { GamePreset } from "../../types/game-presets";

const Icons = {
  Zap,
  Trophy,
  GraduationCap,
  Wrench,
} as const;

interface PresetCardProps {
  preset: GamePreset;
  isSelected: boolean;
  onSelect: () => void;
}

export const PresetCard = ({ preset, isSelected, onSelect }: PresetCardProps) => {
  const Icon = Icons[preset.icon];

  return (
    <button
      onClick={onSelect}
      className={`
        relative p-6 rounded-xl border transition-all text-left w-full panel-wood
        hover:border-gold/50 hover:scale-[1.02]
        ${isSelected ? "border-gold bg-gold/10" : "border-gold/20"}
      `}
    >
      {preset.isRecommended && (
        <span className="absolute -top-3 right-4 px-3 py-1 bg-gold text-brown text-xs font-bold rounded-full shadow-md">
          Recommended
        </span>
      )}

      <div className="flex flex-col gap-4">
        {/* Icon and Title */}
        <div className="flex items-center gap-3">
          <div
            className={`
            p-3 rounded-xl
            ${isSelected ? "bg-gold/20" : "bg-brown/50"}
          `}
          >
            <Icon className={`w-6 h-6 ${isSelected ? "text-gold" : "text-gold/70"}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gold">{preset.name}</h3>
            <p className="text-sm text-gold/60">{preset.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gold/80">{preset.description}</p>

        {/* Features */}
        <ul className="space-y-2">
          {preset.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gold/70">
              <CheckCircle2 className="w-4 h-4 text-brilliance flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Selection indicator */}
        <div
          className={`
          mt-2 py-2 px-4 rounded-lg text-center text-sm font-semibold transition-colors
          ${isSelected ? "bg-gold text-brown" : "bg-brown/50 text-gold/70"}
        `}
        >
          {isSelected ? "Selected" : "Click to select"}
        </div>
      </div>
    </button>
  );
};
