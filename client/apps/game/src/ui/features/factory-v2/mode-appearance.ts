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
      "border-[#d9c8ae] bg-[linear-gradient(180deg,rgba(246,239,227,0.98),rgba(241,232,217,0.98))] text-[#1d1712] shadow-[0_28px_80px_rgba(0,0,0,0.18)]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_12%_14%,rgba(245,158,11,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(180,83,9,0.12),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.18),transparent_48%)]",
    sectionDividerClassName: "border-[#d8c7b0]",
    accentTextClassName: "text-[#9a5807]",
    mainSurfaceClassName:
      "border border-[#e3d6c5] bg-[linear-gradient(180deg,rgba(255,252,247,0.95),rgba(248,239,226,0.92))] shadow-[0_24px_60px_rgba(81,54,24,0.08)]",
    featureSurfaceClassName:
      "border border-[#e8d8c2] bg-[linear-gradient(180deg,rgba(255,249,241,0.98),rgba(249,237,219,0.9))] shadow-[0_18px_40px_rgba(81,54,24,0.08)]",
    quietSurfaceClassName: "border border-[#ebdfcf] bg-[rgba(249,241,229,0.72)]",
    listItemClassName:
      "border border-[#e8ddce] bg-[rgba(255,255,255,0.52)] transition-colors duration-200 hover:bg-[rgba(255,255,255,0.72)]",
    activeToggleClassName: "bg-[#1f1711] text-[#fff7ec] shadow-[0_8px_20px_rgba(31,23,17,0.12)]",
    inactiveToggleClassName: "text-[#5f5348] hover:bg-black/[0.04] hover:text-[#1f1711]",
    primaryButtonClassName: "bg-[#1f1711] text-[#fff7ec] hover:bg-[#2c221b]",
    secondaryButtonClassName:
      "border border-[#d7c7b4] bg-[rgba(255,255,255,0.56)] text-[#36291f] hover:bg-[rgba(255,255,255,0.82)]",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(245,158,11,0.32),rgba(217,119,6,0.08),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(145,83,4,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(145,83,4,0.06)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
  blitz: {
    canvasClassName:
      "border-[#b49973] bg-[linear-gradient(180deg,rgba(224,206,177,0.98),rgba(191,162,122,0.98))] text-[#17100b] shadow-[0_28px_80px_rgba(0,0,0,0.22)]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_14%_16%,rgba(180,83,9,0.22),transparent_24%),radial-gradient(circle_at_86%_18%,rgba(92,41,13,0.18),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_48%)]",
    sectionDividerClassName: "border-[rgba(86,56,31,0.18)]",
    accentTextClassName: "text-[#7a3d09]",
    mainSurfaceClassName:
      "border border-[#c5aa85] bg-[linear-gradient(180deg,rgba(244,233,216,0.95),rgba(216,189,151,0.92))] shadow-[0_24px_60px_rgba(70,44,20,0.12)]",
    featureSurfaceClassName:
      "border border-[#ccb28d] bg-[linear-gradient(180deg,rgba(241,228,209,0.97),rgba(208,180,141,0.92))] shadow-[0_18px_40px_rgba(70,44,20,0.12)]",
    quietSurfaceClassName: "border border-[#cdb28e] bg-[rgba(225,204,174,0.74)]",
    listItemClassName:
      "border border-[#ccb28f] bg-[rgba(255,247,236,0.42)] transition-colors duration-200 hover:bg-[rgba(255,247,236,0.62)]",
    activeToggleClassName: "bg-[#18100c] text-[#fff4e6] shadow-[0_8px_20px_rgba(24,16,12,0.16)]",
    inactiveToggleClassName: "text-[#574535] hover:bg-black/[0.04] hover:text-[#18100c]",
    primaryButtonClassName: "bg-[#18100c] text-[#fff4e6] hover:bg-[#261913]",
    secondaryButtonClassName:
      "border border-[#c5aa86] bg-[rgba(255,246,234,0.5)] text-[#302116] hover:bg-[rgba(255,246,234,0.76)]",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(217,119,6,0.34),rgba(120,53,15,0.12),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(120,53,15,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(120,53,15,0.08)_1px,transparent_1px)] bg-[size:28px_28px]",
  },
};

export const resolveFactoryModeAppearance = (mode: FactoryGameMode) => MODE_APPEARANCES[mode];
