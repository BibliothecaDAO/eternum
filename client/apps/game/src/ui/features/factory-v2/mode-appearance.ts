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
      "border-[#b6a07b] bg-[linear-gradient(180deg,rgba(221,205,178,0.98),rgba(185,160,123,0.98))] text-[#17110c] shadow-[0_28px_80px_rgba(0,0,0,0.22)]",
    backdropClassName:
      "bg-[radial-gradient(circle_at_12%_14%,rgba(16,185,129,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(120,113,28,0.2),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.06),transparent_46%)]",
    sectionDividerClassName: "border-[rgba(81,60,34,0.18)]",
    accentTextClassName: "text-[#6e5324]",
    mainSurfaceClassName:
      "border border-[#c4ab84] bg-[linear-gradient(180deg,rgba(243,235,222,0.95),rgba(214,191,154,0.92))] shadow-[0_24px_60px_rgba(70,44,20,0.11)]",
    featureSurfaceClassName:
      "border border-[#ccb28c] bg-[linear-gradient(180deg,rgba(246,238,225,0.97),rgba(221,197,159,0.92))] shadow-[0_18px_40px_rgba(70,44,20,0.1)]",
    quietSurfaceClassName: "border border-[#d0ba96] bg-[rgba(232,214,187,0.74)]",
    listItemClassName:
      "border border-[#d2bd9d] bg-[rgba(255,249,240,0.44)] transition-colors duration-200 hover:bg-[rgba(255,249,240,0.64)]",
    activeToggleClassName: "bg-[#1f1711] text-[#fff7ec] shadow-[0_8px_20px_rgba(31,23,17,0.12)]",
    inactiveToggleClassName: "text-[#5f5348] hover:bg-black/[0.04] hover:text-[#1f1711]",
    primaryButtonClassName: "bg-[#1f1711] text-[#fff7ec] hover:bg-[#2c221b]",
    secondaryButtonClassName:
      "border border-[#ccb693] bg-[rgba(255,249,240,0.5)] text-[#302116] hover:bg-[rgba(255,249,240,0.76)]",
    artGlowClassName: "bg-[radial-gradient(circle,rgba(16,185,129,0.22),rgba(161,98,7,0.16),transparent_68%)]",
    artGridClassName:
      "bg-[linear-gradient(rgba(86,63,39,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(86,63,39,0.08)_1px,transparent_1px)] bg-[size:28px_28px]",
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
