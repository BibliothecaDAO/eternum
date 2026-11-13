import { XP_RING } from "./words";

/**
 * An army's way to its next skill point, as a ring around its portrait (the owner, 13 November 2026: "a circle around
 * the army maybe getting filled in % to the next level"): a thin gold arc filled clockwise from the top by `share` (0 to
 * 1, nextSkillPoint's), over a faint track. It stands still and covers nothing of the portrait: it lies over its
 * positioned parent, `inset` pixels outside it, and takes no pointer.
 */
export const XpRing = ({ share, inset = -4 }: { share: number; inset?: number }) => {
  const filled = Math.max(0, Math.min(1, share));
  return (
    <svg
      role="img"
      aria-label={XP_RING.label(Math.floor(filled * 100))}
      viewBox="0 0 40 40"
      className="pointer-events-none absolute text-hud-gold"
      style={{ inset }}
    >
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth="3" />
      {filled > 0 && (
        <circle
          cx="20"
          cy="20"
          r="18.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${filled * 100} 100`}
          transform="rotate(-90 20 20)"
        />
      )}
    </svg>
  );
};
