import { EnvChip } from "./env-mark";

/** The lockup's height per place: the phone's top row and the desktop top bar (painted pass). */
const LOCKUP_HEIGHT = { phone: 28, desktop: 30 } as const;

/**
 * The app's one logo (ruled): the kit's mark and "Realms", one SVG so the word is drawn, never typed. The Dev chip sits
 * after it on the dev build.
 */
export const Lockup = ({ size }: { size: keyof typeof LOCKUP_HEIGHT }) => (
  <span className="flex items-center gap-3">
    <img
      src="/images/logos/realms-lockup.svg"
      alt="Realms"
      height={LOCKUP_HEIGHT[size]}
      style={{ height: LOCKUP_HEIGHT[size] }}
      className="block w-auto"
    />
    <EnvChip />
  </span>
);
