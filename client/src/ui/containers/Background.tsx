import clsx from "clsx";
import { ReactNode } from "react";

export const Background = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={clsx("z-0 w-full h-full", className)}>{children}</div>;
};
