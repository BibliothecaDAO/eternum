/**
 * Frontier's flat ink-and-gold glyphs (design §3.12, icon set): one drawing each, the same on the dock, the tile card
 * and every sheet. Placeholders for the assets lane's art where it has not landed; the shapes are the designer's.
 */
const INK = "#1b1207";
const GOLD = "#dfaa54";
const PARCHMENT = "#eadfc8";
const STAMINA = "#9fd06a";

/** Attack, the verb on the tile card's button: a flat sword, blade parchment on an ink outline, gold hilt. */
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

/** Play: a flat gold arrowhead, the verb of the app's first tab. */
export const PlayGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 28 28" className={className} aria-hidden>
    <path d="M8 5.5v17l14-8.5z" fill={GOLD} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

/** Discord's own mark (the Simple Icons drawing), in white on the sign-in flow's Discord button. */
export const DiscordGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden>
    <path
      fill="#fff"
      d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
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
