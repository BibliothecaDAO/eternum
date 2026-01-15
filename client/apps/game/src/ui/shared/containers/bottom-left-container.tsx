import { ReactNode, memo } from "react";

interface BottomLeftContainerProps {
  children?: ReactNode;
}

export const BottomLeftContainer = memo(({ children }: BottomLeftContainerProps) => {
  return <div className="absolute flex flex-col bottom-0 left-0 root-container z-30 w-full">{children}</div>;
});
