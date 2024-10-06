import { ReactNode } from "react";

interface BottomLeftContainerProps {
  children?: ReactNode;
}

export const BottomLeftContainer = ({ children }: BottomLeftContainerProps) => {
  return <div className="absolute flex flex-col bottom-4 left-4 root-container">{children}</div>;
};
