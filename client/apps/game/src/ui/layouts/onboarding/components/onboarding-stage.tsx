import { ReactNode } from "react";

import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";

import { StepContainer, StepContainerProps } from "./step-container";

interface OnboardingStageProps {
  children: ReactNode;
  stepProps?: Partial<Omit<StepContainerProps, "children">>;
}

export const OnboardingStage = ({ children, stepProps }: OnboardingStageProps) => (
  <>
    {/* Left side - Logo (hidden on mobile) */}
    <div className="pointer-events-none hidden md:flex flex-1 items-center pl-8 lg:pl-16">
      <EternumWordsLogo className="fill-brown w-48 lg:w-72 xl:w-[360px]" />
    </div>
    {/* Right side - Panel */}
    <div className="flex flex-1 items-center justify-center md:justify-end p-4 md:p-0">
      <StepContainer showLogo={false} {...stepProps}>
        {children}
      </StepContainer>
    </div>
  </>
);
