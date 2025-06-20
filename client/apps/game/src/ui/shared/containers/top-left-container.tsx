import { memo } from "react";

const TopLeftContainer = memo(({ children }: { children: React.ReactNode }) => {
  return <div className="absolute top-0 left-0 pointer-events-auto z-20">{children}</div>;
});

export default TopLeftContainer;
