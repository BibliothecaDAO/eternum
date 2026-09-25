/**
 * Frontier's flat ink-and-gold glyphs (design §3.12, icon set): one drawing each, the same on the dock, the tile card
 * and every sheet. Placeholders for the assets lane's art where it has not landed; the shapes are the designer's.
 */
const INK = "#1b1207";
const GOLD = "#dfaa54";
const PARCHMENT = "#eadfc8";
const STAMINA = "#9fd06a";

/** Strength: a flat sword, blade parchment on an ink outline, gold hilt. */
export const SwordGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path
      d="M20.5 4.5 23.5 4.5 23.5 7.5 12 19 9 16z"
      fill={PARCHMENT}
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M6.5 15.5 12.5 21.5" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
    <path d="M9.5 18.5 5 23" stroke={INK} strokeWidth="3.4" strokeLinecap="round" />
    <path d="M9.5 18.5 5 23" stroke={GOLD} strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** Stamina: the bolt in the stamina bar's green, the same everywhere a bar shows. */
export const BoltGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path d="M16 3 6 16h7l-2 9 11-14h-7z" fill={STAMINA} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

/** A day's army slot: a banner, gold when an army holds it, an outline while it is free. */
export const SlotBanner = ({ used }: { used: boolean }) => (
  <svg viewBox="0 0 22 30" width="22" height="30" aria-hidden>
    <path d="M2 2h18v22l-9-5-9 5z" fill={used ? GOLD : "none"} stroke={GOLD} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
