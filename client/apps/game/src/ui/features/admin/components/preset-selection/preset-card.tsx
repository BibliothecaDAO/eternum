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
        relative p-6 rounded-2xl border-2 transition-all text-left w-full
        hover:border-blue-400 hover:shadow-lg hover:scale-[1.02]
        ${isSelected ? "border-blue-500 bg-blue-50 shadow-lg shadow-blue-500/20" : "border-slate-200 bg-white"}
      `}
    >
      {preset.isRecommended && (
        <span className="absolute -top-3 right-4 px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-full shadow-md">
          Recommended
        </span>
      )}

      <div className="flex flex-col gap-4">
        {/* Icon and Title */}
        <div className="flex items-center gap-3">
          <div
            className={`
            p-3 rounded-xl
            ${isSelected ? "bg-blue-100" : "bg-slate-100"}
          `}
          >
            <Icon className={`w-6 h-6 ${isSelected ? "text-blue-600" : "text-slate-700"}`} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">{preset.name}</h3>
            <p className="text-sm text-slate-500">{preset.tagline}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-slate-600">{preset.description}</p>

        {/* Features */}
        <ul className="space-y-2">
          {preset.features.map((feature, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-600">
              <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {/* Selection indicator */}
        <div
          className={`
          mt-2 py-2 px-4 rounded-lg text-center text-sm font-semibold transition-colors
          ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}
        `}
        >
          {isSelected ? "Selected" : "Click to select"}
        </div>
      </div>
    </button>
  );
};
