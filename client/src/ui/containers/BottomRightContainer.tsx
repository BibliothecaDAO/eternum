import { ReactNode } from "react";

interface BottomRightContainerProps {
  children?: ReactNode;
}

export const BottomRightContainer = ({ children }: BottomRightContainerProps) => {
  return <div className="absolute flex flex-col bottom-2 right-2 root-container z-20">{children}</div>;
};
