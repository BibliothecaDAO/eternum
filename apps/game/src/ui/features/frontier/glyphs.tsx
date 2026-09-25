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

/** The expedition: a folded map. */
export const MapGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path
      d="M4 7l6-2.5 8 2.5 6-2.5v16.5L18 23.5l-8-2.5-6 2.5z"
      fill={PARCHMENT}
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M10 4.5v16.5M18 7v16.5" stroke={INK} strokeWidth="1.4" />
  </svg>
);

/** The realm: a castle's two towers and gate. */
export const CastleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path
      d="M4 24V9h2v2h2V9h2v3h8V9h2v2h2V9h2v15h-7v-5a3 3 0 0 0-6 0v5z"
      fill={PARCHMENT}
      stroke={INK}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

/** Picks waiting on an army: a fan of two cards. */
export const CardFanGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <rect
      x="5"
      y="6"
      width="12"
      height="17"
      rx="2"
      transform="rotate(-12 11 14)"
      fill={PARCHMENT}
      stroke={INK}
      strokeWidth="1.4"
    />
    <rect
      x="11"
      y="5"
      width="12"
      height="17"
      rx="2"
      transform="rotate(10 17 13)"
      fill={GOLD}
      stroke={INK}
      strokeWidth="1.4"
    />
  </svg>
);

/** An open slot: its banner with a plus, waiting for a muster. */
export const PlusGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path d="M14 7v14M7 14h14" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
  </svg>
);
