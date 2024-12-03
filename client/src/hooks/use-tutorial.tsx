import { useCallback, useMemo } from "react";
import { useShepherd } from "react-shepherd";
import { StepOptions } from "shepherd.js";

export const useTutorial = (steps: StepOptions[] | undefined) => {
  const shepherd = useShepherd();
  const tour = useMemo(
    () =>
      new shepherd.Tour({
        useModalOverlay: true,
        exitOnEsc: true,
        keyboardNavigation: false,
        defaultStepOptions: {
          modalOverlayOpeningPadding: 5,
          arrow: true,
          cancelIcon: { enabled: true },
        },
        steps,
      }),
    [shepherd, steps],
  );

  const handleStart = useCallback(() => {
    if (!tour) return;
    tour.start();
  }, [tour]);

  return { handleStart };
};
