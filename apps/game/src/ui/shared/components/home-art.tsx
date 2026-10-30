import "./home-art.css";

import { Icon } from "@/ui/design-system/icon";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";

/** A campaign ticket's tier, which colours its painting's ground; a free home's is plain. */
type HomeArtTier = "golden" | "regular" | "free";

/**
 * A home's picture, as the Realm step and the Realm Labor sheet both draw it: a held Realm's map from the Realm index in
 * the parchment's tones, or a painting (a ticket's pavilion on its tier's colour, the Realm's when it has no map). The
 * frame's size is the caller's, and so is the painting's.
 */
export const HomeArt = ({
  map,
  icon,
  size,
  tier,
  eager = false,
}: {
  map?: string | null;
  icon: IconMeaning;
  size: number;
  tier?: HomeArtTier;
  eager?: boolean;
}) => (
  <span className="home-art" data-tier={tier} data-map={map ? "drawn" : "none"}>
    {map ? (
      <img className="home-art__map" src={map} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
    ) : (
      <Icon name={icon} size={size} />
    )}
  </span>
);
