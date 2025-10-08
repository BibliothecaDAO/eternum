import { ReactNode } from "react";

interface OnboardingContainerProps {
  children: ReactNode;
  backgroundImage: string;
}

export const OnboardingContainer = ({ children, backgroundImage }: OnboardingContainerProps) => (
  <div className="relative min-h-screen w-full pointer-events-auto">
    <img
      className="absolute h-screen w-screen object-cover"
      src={`/images/covers/blitz/${backgroundImage}.png`}
      alt="Cover"
    />
    <div className="absolute z-10 w-screen h-screen">{children}</div>
  </div>
);
