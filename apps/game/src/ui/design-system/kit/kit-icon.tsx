import { cn } from "@/ui/design-system/atoms/lib/utils";
import { ResourcesIds } from "@bibliothecadao/types";

/**
 * The handoff's icon codes (frontier-mobile-ui/handoff.html, Icons) drawn with the art that exists today. A code the
 * art pass redraws changes here and nowhere else.
 */
const ICONS = {
  Es: `/images/resources/${ResourcesIds.Essence}.png`,
  La: `/images/resources/${ResourcesIds.Labor}.png`,
  Wh: `/images/resources/${ResourcesIds.Wheat}.png`,
  Tr: `/images/resources/${ResourcesIds.Knight}.png`,
  Lo: `/images/resources/${ResourcesIds.Lords}.png`,
  St: "/image-icons/ui-lightning.png",
  Hg: "/image-icons/hourglass.png",
  Fl: "/image-icons/ui-flag.png",
  Of: "/image-icons/ui-network-off.png",
  Cv: "/image-icons/ui-chevron-down.png",
  Sp: "/image-icons/ui-refresh.png",
} as const;

export type IconCode = keyof typeof ICONS;

/** Codes drawn turned: the chevron that says a row opens points right. */
const TURNS: Partial<Record<IconCode, number>> = { Cv: -90 };

/** An icon by its code; decorative, since the control around it carries the word. */
export const KitIcon = ({ code, size = 20, className }: { code: IconCode; size?: number; className?: string }) => (
  <img
    src={ICONS[code]}
    alt=""
    aria-hidden
    width={size}
    height={size}
    draggable={false}
    className={cn("inline-block shrink-0 object-contain", className)}
    style={TURNS[code] ? { rotate: `${TURNS[code]}deg` } : undefined}
  />
);
