import { BootDebugPanel, BootLoaderShell } from "@/ui/modules/boot-loader";

interface LoadingScreenProps {
  progress?: number;
  title?: string;
  subtitle?: string;
  /**
   * Human-readable label for the active boot phase (e.g. "Connecting to world").
   * Surfaced inside the debug panel so a stalled cold-reload can be diagnosed
   * (slow RPC vs slow initial sync vs slow renderer) without opening DevTools.
   */
  currentTaskLabel?: string | null;
  /** Hide the debug panel — useful for non-boot loading screens that don't have timeline data. */
  hideDebugPanel?: boolean;
}

export const LoadingScreen = ({
  progress,
  title = "Forging the Realm",
  subtitle = "Summoning terrain, armies, and ancient trade routes.",
  currentTaskLabel,
  hideDebugPanel = false,
}: LoadingScreenProps) => {
  return (
    <BootLoaderShell
      mode={typeof progress === "number" && progress > 0 ? "determinate" : "indeterminate"}
      progress={progress}
      title={title}
      subtitle={subtitle}
      caption="Initializing"
      detail={hideDebugPanel ? undefined : <BootDebugPanel currentTaskLabel={currentTaskLabel} />}
    />
  );
};
