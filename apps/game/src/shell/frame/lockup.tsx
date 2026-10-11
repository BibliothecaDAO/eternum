import { EnvChip } from "./env-mark";

/**
 * The app's one logo (ruled): the kit's mark and "Realms", one SVG so the word is drawn, never typed, in the phone's
 * top row; the desktop rail draws the stacked arrangement of the same parts. The Dev chip sits after it on the dev
 * build.
 */
export const Lockup = () => (
  <span className="flex items-center gap-3">
    <img
      src="/images/logos/realms-lockup.svg"
      alt="Realms"
      height={28}
      style={{ height: 28 }}
      className="block w-auto"
    />
    <EnvChip />
  </span>
);
