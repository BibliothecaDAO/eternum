import { ReactNode } from "react";

interface BottomLeftContainerProps {
  children?: ReactNode;
}

export const BottomLeftContainer = ({ children }: BottomLeftContainerProps) => {
  return <div className="absolute flex flex-col bottom-2 left-2 root-container">{children}</div>;
};
