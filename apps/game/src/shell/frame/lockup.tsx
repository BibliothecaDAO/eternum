import { REALMS_MARK } from "@/ui/design-system/icon-meaning";
import { EnvChip } from "./env-mark";

/**
 * The app's mark in the phone's top row and at the start of the desktop's top bar: the brand's lettered mark, its word
 * part of the artwork and never typed beside it, at the size the app sheet gives it (`--app-mark`). The Dev chip sits
 * after it on the dev build.
 */
export const Lockup = () => (
  <span className="flex items-center gap-3">
    <img src={REALMS_MARK.lettered} alt="Realms" className="app-mark" />
    <EnvChip />
  </span>
);
