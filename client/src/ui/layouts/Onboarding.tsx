import { useEffect, useState } from "react";
import { Naming, StepFive, StepFour, StepOne, StepSix, StepThree, StepTwo } from "../modules/onboarding/Steps";

export const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(1);

  const nextStep = () => setCurrentStep(currentStep + 1);
  const prevStep = () => setCurrentStep(currentStep - 1);

  const [backgroundImage, setBackgroundImage] = useState("01");

  useEffect(() => {
    // Get current timestamp in seconds
    const timestamp = Math.floor(Date.now() / 1000);
    // Get a number between 1-7 based on timestamp
    const imageNumber = (timestamp % 7) + 1;
    // Pad with leading zero if needed
    const paddedNumber = imageNumber.toString().padStart(2, "0");
    setBackgroundImage(paddedNumber);

    // const interval = setInterval(() => {
    //   setBackgroundImage((prev) => (prev === "07" ? "01" : (parseInt(prev) + 1).toString().padStart(2, "0")));
    // }, 3000); // Change statement every 3 seconds

    // return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen w-full pointer-events-auto">
      <img
        className="absolute h-full w-full object-cover md:h-screen md:w-screen"
        src={`/images/covers/${backgroundImage}.png`}
        alt="background"
      />
      <div className="absolute z-10 w-full h-full px-4 md:px-0 flex justify-center items-center flex-wrap self-center">
        <div className="w-full max-w-md md:max-w-lg">
          {currentStep === 1 && <StepOne onNext={nextStep} />}
          {currentStep === 2 && <Naming onNext={nextStep} />}
          {currentStep === 3 && <StepTwo onNext={nextStep} />}
          {currentStep === 4 && <StepThree onPrev={prevStep} onNext={nextStep} />}
          {currentStep === 5 && <StepFour onPrev={prevStep} onNext={nextStep} />}
          {currentStep === 6 && <StepFive onPrev={prevStep} onNext={nextStep} />}
          {currentStep === 7 && <StepSix onPrev={prevStep} onNext={nextStep} />}
        </div>
      </div>
    </div>
  );
};
