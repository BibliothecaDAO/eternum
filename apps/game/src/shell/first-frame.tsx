import { REALMS_MARK } from "@/ui/design-system/icon-meaning";

/**
 * The app's first frame (spec 14): the lettered mark on the ground, as the page loads, while a lazy page arrives, and when the
 * app could not start; the install's splash matches it. Never a black page or an empty one.
 */
export const FirstFrame = () => (
  <div className="fixed inset-0 grid place-items-center bg-kit-ground">
    <img src={REALMS_MARK.lettered} alt="Realms" className="h-auto w-[min(60vw,240px)]" />
  </div>
);
