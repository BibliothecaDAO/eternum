import { ReactNode } from "react";

interface BottomRightContainerProps {
  children?: ReactNode;
}

export const BottomRightContainer = ({ children }: BottomRightContainerProps) => {
  return <div className="absolute flex flex-col w-1/4 h-[550px] bottom-10 right-6  root-container">{children}</div>;
};
