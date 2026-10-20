import { BootDebugPanel } from "@/ui/debug/boot-debug-panel";
import { BootLoaderShell } from "@/ui/modules/boot-loader";

interface LoadingScreenProps {
  progress?: number;
  title?: string;
  subtitle?: string;
}

export const LoadingScreen = ({
  progress,
  title = "Entering the World",
  subtitle = "Connecting to the world…",
}: LoadingScreenProps) => {
  return (
    <BootLoaderShell
      progress={progress}
      title={title}
      subtitle={subtitle}
      caption="Initializing"
      detail={<BootDebugPanel />}
    />
  );
};
