import { memo } from "react";

const TopCenterContainer = memo(({ children }: { children: React.ReactNode }) => {
  return <div className="absolute w-screen top-10 flex pointer-events-none z-100">{children}</div>;
});

export default TopCenterContainer;
