import { ReactNode } from "react";

interface BottomRightContainerProps {
  children?: ReactNode;
}

export const BottomRightContainer = ({ children }: BottomRightContainerProps) => {
  return <div className="absolute flex flex-col bottom-10 right-4  root-container">{children}</div>;
};
