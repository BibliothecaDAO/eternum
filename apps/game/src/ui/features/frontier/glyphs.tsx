/**
 * Frontier's flat ink-and-gold glyphs (design §3.12, icon set): one drawing each, the same on the dock, the tile card
 * and every sheet. Placeholders for the assets lane's art where it has not landed; the shapes are the designer's.
 */
const INK = "#1b1207";
const GOLD = "#dfaa54";
const PARCHMENT = "#eadfc8";

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

/** Population: a figure's head and shoulders in parchment. */
export const PersonGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <circle cx="14" cy="9.5" r="4.5" fill={PARCHMENT} stroke={INK} strokeWidth="1.5" />
    <path d="M5.5 23.5a8.5 7 0 0 1 17 0z" fill={PARCHMENT} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);
