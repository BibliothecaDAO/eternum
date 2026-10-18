import { Icon as SemanticIcon, type IconMeaning } from "@/ui/design-system/icon";
import type { ReactNode } from "react";

import { cn } from "@/ui/design-system/atoms/lib/utils";

type PillSize = "sm" | "md" | "lg";
type PillTone = "cream" | "muted" | "gold" | "sage" | "live";

/** Small and medium pills hold one short fact and never wrap or shrink; a large one holds a sentence. */
const SIZES: Record<PillSize, string> = {
  sm: "h-7 shrink-0 gap-1 whitespace-nowrap pl-1.5 pr-2.5 text-caption",
  md: "h-8 shrink-0 gap-1.5 whitespace-nowrap pl-1.5 pr-3 text-caption",
  lg: "h-9 gap-1.5 pl-2 pr-3 text-body",
};

/**
 * A state (cream) and Live keep the HUD chip's look, the veil a painting shows through, wherever they sit: a Play card,
 * a lobby, a settings row, the doorway. The plate's own pills (a credit, a wallet, a reward) sit on ink with the
 * brighter edge.
 */
const TONES: Record<PillTone, string> = {
  cream: "border-kit-line bg-kit-veil/[.72] text-kit-cream",
  live: "border-kit-sage/55 bg-kit-veil/[.72] pl-2.5 text-kit-sage",
  muted: "border-kit-line2 bg-kit-ink text-kit-muted",
  sage: "border-kit-line2 bg-kit-ink text-kit-sage",
  gold: "border-kit-line2 bg-kit-ink text-kit-gold2",
};

const ICON_SIZES: Record<PillSize, number> = { sm: 18, md: 20, lg: 20 };

/**
 * A rounded chip of one fact: its icon and a few words ("Closed", "Starts 16:30 · in 2h 4m", "Credit ×2"), or the icon
 * alone. Live leads with the sage dot instead of an icon. A struck pill crosses its icon out in red (a prize that does
 * not come). The HUD's amount chip is `Chip`, on the HUD's own chip token.
 */
export const Pill = ({
  icon,
  size = "md",
  tone = "cream",
  rimmed = false,
  struck = false,
  as = "span",
  onClick,
  className,
  children,
}: {
  icon?: IconMeaning;
  size?: PillSize;
  tone?: PillTone;
  /** The edge drawn in the tone's own colour (a credit's gold), not the plate's line. */
  rimmed?: boolean;
  struck?: boolean;
  as?: "span" | "button";
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}) => {
  // A state's icon fills the chip's height, as the HUD's chips draw theirs.
  const mark = icon && <SemanticIcon name={icon} size={tone === "cream" ? 28 : ICON_SIZES[size]} />;
  const classes = cn(
    "inline-flex items-center rounded-full border font-ui font-bold",
    SIZES[size],
    TONES[tone],
    rimmed && tone === "gold" && "border-kit-gold",
    className,
  );
  const content = (
    <>
      {tone === "live" && <i aria-hidden className="size-2.5 rounded-full bg-kit-sage shadow-live" />}
      {struck ? (
        <span className="relative flex opacity-60">
          {mark}
          <span aria-hidden className="absolute left-0 top-1/2 h-0.5 w-5 -rotate-45 bg-kit-red" />
        </span>
      ) : (
        mark
      )}
      {children}
    </>
  );
  return as === "button" ? (
    <button type="button" onClick={onClick} className={classes}>
      {content}
    </button>
  ) : (
    <span className={classes}>{content}</span>
  );
};
