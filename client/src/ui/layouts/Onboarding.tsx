import { useState } from "react";
import { env } from "../../../env";
import { Naming, StepFour, StepOne, StepThree } from "../modules/onboarding/Steps";

export const Onboarding = ({ backgroundImage }: { backgroundImage: string }) => {
  const [currentStep, setCurrentStep] = useState(env.VITE_PUBLIC_DEV ? 1 : 3);

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  return (
    <div className="relative min-h-screen w-full pointer-events-auto">
      <img
        className="absolute h-full w-full object-cover md:h-screen md:w-screen"
        src={`/images/covers/${backgroundImage}.png`}
        alt="background"
      />
      <div className="absolute z-10 w-full h-full px-4 md:px-0 flex justify-center items-center flex-wrap self-center">
        <div className="w-full max-w-md md:max-w-lg">
          {currentStep === 1 && env.VITE_PUBLIC_DEV && <StepOne onNext={nextStep} />}
          {currentStep === 2 && env.VITE_PUBLIC_DEV && <Naming onNext={nextStep} />}
          {currentStep === 3 && <StepThree onNext={nextStep} />}
          {currentStep === 4 && <StepFour onPrevious={prevStep} />}
        </div>
      </div>
    </div>
  );
};
