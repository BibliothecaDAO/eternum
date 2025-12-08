import { memo } from "react";

const LeftMiddleContainer = memo(({ children }: { children: React.ReactNode }) => {
  return <div className="absolute z-20 w-auto top-0 h-screen left-0 flex pointer-events-none">{children}</div>;
});

export default LeftMiddleContainer;
