import { ReactNode } from "react";

interface BottomRightContainerProps {
  children?: ReactNode;
}

export const BottomRightContainer = ({ children }: BottomRightContainerProps) => {
  return <div className="absolute flex flex-col bottom-0 right-0 root-container z-20">{children}</div>;
};
