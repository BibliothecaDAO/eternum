import { ReactNode, memo } from "react";

interface BottomRightContainerProps {
  children?: ReactNode;
}

export const BottomRightContainer = memo(({ children }: BottomRightContainerProps) => {
  return <div className="absolute flex flex-col bottom-0 right-0 root-container z-30 w-full">{children}</div>;
});
