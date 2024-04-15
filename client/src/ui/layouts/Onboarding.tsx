import { useCallback, useEffect, useState } from "react";
import { MAX_REALMS } from "../components/cityview/realm/SettleRealmComponent";
import { useLocation } from "wouter";
import { useEntities } from "@/hooks/helpers/useEntities";
import { Naming, StepOne, StepThree, StepTwo } from "../modules/onboarding/Steps";

export const Onboarding = () => {
  const { playerRealms } = useEntities();
  const [_location, setLocation] = useLocation();

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
      <img className="absolute h-screen w-screen object-cover" src="/images/cover-3.jpeg" alt="" />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
        {currentStep === 1 && <StepOne onNext={nextStep} />}
        {currentStep === 2 && <Naming onNext={handleNamingNext} />}
        {currentStep === 3 && <StepTwo onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 4 && <StepThree />}
      </div>
    </div>
  );
};
