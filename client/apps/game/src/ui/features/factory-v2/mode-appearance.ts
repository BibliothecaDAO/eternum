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
      "border-gold/15 bg-black/25 text-gold/90 shadow-[0_28px_80px_rgba(0,0,0,0.4)] backdrop-blur-[12px]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_12%_14%,rgba(16,185,129,0.06),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(223,170,84,0.06),transparent_28%)]",
    sectionDividerClassName: "border-gold/10",
    accentTextClassName: "text-gold",
    mainSurfaceClassName: "border border-gold/15 bg-black/30 shadow-[0_24px_60px_rgba(0,0,0,0.2)] backdrop-blur-[8px]",
    featureSurfaceClassName:
      "border border-gold/10 bg-black/25 shadow-[0_18px_40px_rgba(0,0,0,0.18)] backdrop-blur-[8px]",
    quietSurfaceClassName: "border border-gold/10 bg-black/20 backdrop-blur-[6px]",
    listItemClassName:
      "border border-gold/10 bg-black/20 transition-colors duration-200 hover:bg-black/30 hover:border-gold/20",
    activeToggleClassName: "bg-gold text-black shadow-[0_0_12px_rgba(223,170,84,0.3)]",
    inactiveToggleClassName: "text-gold/50 hover:bg-gold/10 hover:text-gold/70",
    primaryButtonClassName: "bg-gold text-black hover:bg-gold/90 shadow-[0_0_16px_rgba(223,170,84,0.2)]",
    secondaryButtonClassName: "border border-gold/20 bg-black/20 text-gold/80 hover:bg-gold/10 hover:border-gold/30",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(16,185,129,0.08),rgba(223,170,84,0.06),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(223,170,84,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(223,170,84,0.04)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
  blitz: {
    canvasClassName:
      "border-gold/15 bg-black/25 text-gold/90 shadow-[0_28px_80px_rgba(0,0,0,0.4)] backdrop-blur-[12px]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_14%_16%,rgba(232,148,74,0.08),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(223,170,84,0.06),transparent_26%)]",
    sectionDividerClassName: "border-gold/10",
    accentTextClassName: "text-[#e8944a]",
    mainSurfaceClassName: "border border-gold/15 bg-black/30 shadow-[0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-[8px]",
    featureSurfaceClassName:
      "border border-gold/10 bg-black/25 shadow-[0_18px_40px_rgba(0,0,0,0.2)] backdrop-blur-[8px]",
    quietSurfaceClassName: "border border-gold/10 bg-black/20 backdrop-blur-[6px]",
    listItemClassName:
      "border border-gold/10 bg-black/20 transition-colors duration-200 hover:bg-black/30 hover:border-gold/20",
    activeToggleClassName: "bg-gold text-black shadow-[0_0_12px_rgba(223,170,84,0.3)]",
    inactiveToggleClassName: "text-gold/50 hover:bg-gold/10 hover:text-gold/70",
    primaryButtonClassName: "bg-[#e8944a] text-black hover:bg-[#f0a35c] shadow-[0_0_16px_rgba(232,148,74,0.2)]",
    secondaryButtonClassName: "border border-gold/20 bg-black/20 text-gold/80 hover:bg-gold/10 hover:border-gold/30",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(232,148,74,0.10),rgba(223,170,84,0.06),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(223,170,84,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(223,170,84,0.04)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
};

export const resolveFactoryModeAppearance = (mode: FactoryGameMode) => MODE_APPEARANCES[mode];
