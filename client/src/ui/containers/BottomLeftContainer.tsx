import { ReactNode } from "react";

export const BottomLeftContainer = ({ children }: { children?: ReactNode }) => {
  return <div className="absolute flex flex-col w-1/4 h-auto bottom-6 left-6">{children}</div>;
};
