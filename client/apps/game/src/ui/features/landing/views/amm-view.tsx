import { cn } from "@/ui/design-system/atoms/lib/utils";
import { lazy, Suspense } from "react";

const AmmDashboard = lazy(() => import("../../amm/amm-dashboard"));

interface AmmViewProps {
  className?: string;
}

const LoadingSpinner = () => (
  <div className="flex min-h-[420px] items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

export const AmmView = ({ className }: AmmViewProps) => {
  return (
    <div
      className={cn(
        "flex w-full max-w-[1500px] flex-col pb-10 lg:h-[calc(100vh-7.5rem)] lg:min-h-0 lg:overflow-hidden lg:pb-0",
        className,
      )}
    >
      <Suspense fallback={<LoadingSpinner />}>
        <AmmDashboard />
      </Suspense>
    </div>
  );
};
