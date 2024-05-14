import { useCallback, useEffect, useState } from "react";
import { MAX_REALMS } from "../components/cityview/realm/SettleRealmComponent";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Naming, StepOne, StepThree, StepTwo, StepFour, StepFive, StepSix } from "../modules/onboarding/Steps";

export const Onboarding = () => {
  const { playerRealms } = useEntities();

  const [currentStep, setCurrentStep] = useState(1);

  const skipOrderSelection = () => setCurrentStep(currentStep + 2);
  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  const canSettle = playerRealms().length < MAX_REALMS;

  const handleNamingNext = useCallback(() => {
    if (canSettle) {
      nextStep();
    } else {
      skipOrderSelection();
    }
  }, [canSettle, nextStep, skipOrderSelection]);

  useEffect(() => {
    if (!canSettle && currentStep === 3) {
      nextStep();
    }
  }, [canSettle, currentStep]);

  return (
    <div className="relative h-screen w-screen">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover.jpeg" alt="" />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
        {currentStep === 1 && <StepOne onNext={nextStep} />}
        {currentStep === 2 && <Naming onNext={handleNamingNext} />}
        {currentStep === 3 && <StepTwo onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 4 && <StepThree onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 5 && <StepFour onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 6 && <StepFive onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 7 && <StepSix onPrev={prevStep} onNext={nextStep} />}
      </div>
    </div>
  );
};
