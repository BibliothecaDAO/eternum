/** The game's covers the shell still wears until sign-in (item 5) and the Blitz list (item 6) take the kit's art. */
export const HERO_ART = "/images/covers/07.png";

export const MODE_ART = { blitz: "/images/covers/blitz-arena.png" } as const;

const REALM_STILLS = ["settlement", "city", "kingdom", "empire"] as const;

/**
 * A realm's castle on its board at its castle level, Tier I to IV (levels 0 to 3), rendered by the realm view itself
 * (public/images/realm-card/SOURCE.md). A level past the stills is loud in dev and draws no castle.
 */
export const realmStill = (level: number): string | null => {
  const still = REALM_STILLS[level];
  if (still) return `/images/realm-card/${still}.webp`;
  const message = `No realm still for castle level ${level}`;
  if (import.meta.env.DEV) throw new Error(message);
  console.error(message);
  return null;
};
