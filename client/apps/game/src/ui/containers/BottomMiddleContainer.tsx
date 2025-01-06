import { memo } from "react";

export const BottomMiddleContainer = memo(({ children }: { children: React.ReactNode }) => {
  return (
    <div className="absolute w-screen bottom-0 left-1/2 transform -translate-x-1/2 flex justify-center pointer-events-none z-20">
      {children}
    </div>
  );
});
