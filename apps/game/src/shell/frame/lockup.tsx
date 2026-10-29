import { REALMS_MARK } from "@/ui/design-system/icon-meaning";
import { EnvChip } from "./env-mark";

/**
 * The app's mark in the phone's top row and at the start of the desktop's top bar: the brand's small globe, the kit's
 * drawing under 64 px, whose word is never typed beside it. The Dev chip sits after it on the dev build.
 */
export const Lockup = () => (
  <span className="flex items-center gap-3">
    <img src={REALMS_MARK.small} alt="Realms" height={32} style={{ height: 32 }} className="block w-auto" />
    <EnvChip />
  </span>
);
