import type { BootstrapTask } from "@/hooks/context/use-unified-onboarding";
import { BootstrapLoadingPanel } from "@/ui/layouts/bootstrap-loading/bootstrap-loading-panel";

interface LoadingPanelProps {
  tasks: BootstrapTask[];
  progress: number;
  error: Error | null;
  onRetry: () => void;
}

export const LoadingPanel = ({ tasks, progress, error, onRetry }: LoadingPanelProps) => {
  return <BootstrapLoadingPanel tasks={tasks} progress={progress} error={error} onRetry={onRetry} />;
};
