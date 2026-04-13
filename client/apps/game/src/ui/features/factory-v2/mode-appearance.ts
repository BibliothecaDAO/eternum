import type { FactoryGameMode } from "./types";

interface FactoryModeAppearance {
  canvasClassName: string;
  backdropClassName: string;
  sectionDividerClassName: string;
  accentTextClassName: string;
  mainSurfaceClassName: string;
  featureSurfaceClassName: string;
  quietSurfaceClassName: string;
  listItemClassName: string;
  activeToggleClassName: string;
  inactiveToggleClassName: string;
  primaryButtonClassName: string;
  secondaryButtonClassName: string;
  artGlowClassName: string;
  artGridClassName: string;
}

const MODE_APPEARANCES: Record<FactoryGameMode, FactoryModeAppearance> = {
  eternum: {
    canvasClassName:
      "border-white/10 bg-[linear-gradient(180deg,rgba(26,22,19,0.98),rgba(18,15,12,0.98))] text-[#fbf4ea] shadow-[0_28px_80px_rgba(0,0,0,0.32)]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_12%_14%,rgba(16,185,129,0.10),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(120,113,28,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_46%)]",
    sectionDividerClassName: "border-[rgba(255,255,255,0.08)]",
    accentTextClassName: "text-[#dfaa54]",
    mainSurfaceClassName:
      "border border-white/10 bg-[linear-gradient(180deg,rgba(32,27,22,0.95),rgba(24,20,16,0.92))] shadow-[0_24px_60px_rgba(0,0,0,0.18)]",
    featureSurfaceClassName:
      "border border-white/8 bg-[linear-gradient(180deg,rgba(30,25,20,0.97),rgba(22,18,14,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.16)]",
    quietSurfaceClassName: "border border-white/8 bg-[rgba(26,22,18,0.74)]",
    listItemClassName:
      "border border-white/8 bg-[rgba(32,27,22,0.44)] transition-colors duration-200 hover:bg-[rgba(32,27,22,0.64)]",
    activeToggleClassName: "bg-[#fbf4ea] text-[#15110f] shadow-[0_8px_20px_rgba(0,0,0,0.18)]",
    inactiveToggleClassName: "text-[#fbf4ea]/50 hover:bg-white/[0.06] hover:text-[#fbf4ea]/70",
    primaryButtonClassName: "bg-[#dfaa54] text-[#15110f] hover:bg-[#e8b964]",
    secondaryButtonClassName:
      "border border-white/12 bg-[rgba(32,27,22,0.5)] text-[#fbf4ea]/80 hover:bg-[rgba(42,36,28,0.76)]",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(16,185,129,0.14),rgba(161,98,7,0.10),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
  blitz: {
    canvasClassName:
      "border-white/10 bg-[linear-gradient(180deg,rgba(26,20,16,0.98),rgba(18,14,11,0.98))] text-[#fbf4ea] shadow-[0_28px_80px_rgba(0,0,0,0.32)]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_14%_16%,rgba(180,83,9,0.14),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(92,41,13,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_48%)]",
    sectionDividerClassName: "border-[rgba(255,255,255,0.08)]",
    accentTextClassName: "text-[#e8944a]",
    mainSurfaceClassName:
      "border border-white/10 bg-[linear-gradient(180deg,rgba(30,24,18,0.95),rgba(22,17,13,0.92))] shadow-[0_24px_60px_rgba(0,0,0,0.20)]",
    featureSurfaceClassName:
      "border border-white/8 bg-[linear-gradient(180deg,rgba(28,22,17,0.97),rgba(20,16,12,0.92))] shadow-[0_18px_40px_rgba(0,0,0,0.18)]",
    quietSurfaceClassName: "border border-white/8 bg-[rgba(24,20,16,0.74)]",
    listItemClassName:
      "border border-white/8 bg-[rgba(30,24,18,0.42)] transition-colors duration-200 hover:bg-[rgba(30,24,18,0.62)]",
    activeToggleClassName: "bg-[#fbf4ea] text-[#15110f] shadow-[0_8px_20px_rgba(0,0,0,0.22)]",
    inactiveToggleClassName: "text-[#fbf4ea]/50 hover:bg-white/[0.06] hover:text-[#fbf4ea]/70",
    primaryButtonClassName: "bg-[#e8944a] text-[#15110f] hover:bg-[#f0a35c]",
    secondaryButtonClassName:
      "border border-white/12 bg-[rgba(30,24,18,0.5)] text-[#fbf4ea]/80 hover:bg-[rgba(40,32,24,0.76)]",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(217,119,6,0.20),rgba(120,53,15,0.08),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
};

export const resolveFactoryModeAppearance = (mode: FactoryGameMode) => MODE_APPEARANCES[mode];
