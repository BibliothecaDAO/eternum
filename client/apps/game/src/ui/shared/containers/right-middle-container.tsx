import { memo } from "react";

const RightMiddleContainer = memo(({ children }: { children: React.ReactNode }) => {
  return <div className="absolute z-20 w-auto right-0 flex h-screen top-0 pointer-events-none">{children}</div>;
});

export default RightMiddleContainer;
