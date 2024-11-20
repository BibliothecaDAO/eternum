import { useState } from "react";
import { Naming, StepFive, StepFour, StepOne, StepSix, StepThree, StepTwo } from "../modules/onboarding/Steps";

export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  return (
    <div className="relative h-screen w-screen pointer-events-auto">
      <img className="absolute h-screen w-screen object-cover" src="/images/cover.png" alt="" />
      <div className="absolute z-10 w-screen h-screen flex justify-center flex-wrap self-center ">
        {currentStep === 1 && <StepOne onNext={nextStep} />}
        {currentStep === 2 && <Naming onNext={nextStep} />}
        {currentStep === 3 && <StepTwo onNext={nextStep} />}
        {currentStep === 4 && <StepThree onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 5 && <StepFour onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 6 && <StepFive onPrev={prevStep} onNext={nextStep} />}
        {currentStep === 7 && <StepSix onPrev={prevStep} onNext={nextStep} />}
      </div>
    </div>
  );
};
