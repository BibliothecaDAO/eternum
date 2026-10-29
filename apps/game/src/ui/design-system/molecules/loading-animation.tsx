import { REALMS_MARK } from "@/ui/design-system/icon-meaning";

/** A wait: the brand's globe at a loader's size (64 to 120 px, the contour drawing). */
export const LoadingAnimation = () => {
  return (
    <div className="p-10 w-full flex justify-center">
      <img src={REALMS_MARK.contour} alt="" className="size-24 self-center" />
    </div>
  );
};
