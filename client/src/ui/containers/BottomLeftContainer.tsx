import { ReactNode } from "react";

interface BottomLeftContainerProps {
  children?: ReactNode;
}

export const BottomLeftContainer = ({ children }: BottomLeftContainerProps) => {
  return <div className="absolute flex flex-col bottom-10 left-4 root-container z-20">{children}</div>;
};
