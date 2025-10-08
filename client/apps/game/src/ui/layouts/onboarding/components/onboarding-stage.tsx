import { ReactNode } from "react";

import { ReactComponent as EternumWordsLogo } from "@/assets/icons/blitz-words-logo-g.svg";

import { StepContainer, StepContainerProps } from "./step-container";

interface OnboardingStageProps {
  children: ReactNode;
  stepProps?: Partial<Omit<StepContainerProps, "children">>;
}

export const OnboardingStage = ({ children, stepProps }: OnboardingStageProps) => (
  <div className="flex h-full w-full">
    <div className="pointer-events-none flex flex-1 items-center pl-16">
      <EternumWordsLogo className="fill-brown w-56 sm:w-48 lg:w-72 xl:w-[360px]" />
    </div>
    <div className="flex flex-1 justify-end">
      <StepContainer showLogo={false} {...stepProps}>
        {children}
      </StepContainer>
    </div>
  </div>
);
