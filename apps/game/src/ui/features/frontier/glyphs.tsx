/**
 * Frontier's flat ink-and-gold glyphs (design §3.12, icon set): one drawing each, the same on the dock, the tile card
 * and every sheet. Placeholders for the assets lane's art where it has not landed; the shapes are the designer's.
 */
const INK = "#1b1207";
const GOLD = "#dfaa54";
const PARCHMENT = "#eadfc8";
const STAMINA = "#9fd06a";

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

/** Population: a figure's head and shoulders in parchment. */
export const PersonGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <circle cx="14" cy="9.5" r="4.5" fill={PARCHMENT} stroke={INK} strokeWidth="1.5" />
    <path d="M5.5 23.5a8.5 7 0 0 1 17 0z" fill={PARCHMENT} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

/** A site taken: a pennant in the stamina green, on its art and beside the exchanges a win takes. */
export const FlagGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path d="M7 4v21" stroke={INK} strokeWidth="3" strokeLinecap="round" />
    <path d="M7 4v21" stroke={PARCHMENT} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M8 5h14l-3.5 4.5L22 14H8z" fill={STAMINA} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

const MEDAL_METALS = {
  1: { face: "#f6c54a", rim: "#a86e00" },
  2: { face: "#dcdfe4", rim: "#7c828c" },
  3: { face: "#d8905a", rim: "#86481f" },
} as const;

/** A top-three place as its medal, gold, silver or bronze on a ribbon, the place's numeral struck on its face. */
export const MedalGlyph = ({ place, className }: { place: 1 | 2 | 3; className?: string }) => {
  const { face, rim } = MEDAL_METALS[place];
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <path d="M8 2h5l2 8h-5zM20 2h-5l-2 8h5z" fill="#b8322a" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="14" cy="17" r="8.5" fill={face} stroke={INK} strokeWidth="1.5" />
      <circle cx="14" cy="17" r="6" fill="none" stroke={rim} strokeWidth="1.2" />
      <text
        x="14"
        y="21"
        textAnchor="middle"
        fontFamily="Lexend, system-ui, sans-serif"
        fontWeight="800"
        fontSize="10.5"
        fill={INK}
      >
        {place}
      </text>
    </svg>
  );
};
