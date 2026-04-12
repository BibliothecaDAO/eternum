import { BootLoaderShell } from "@/ui/modules/boot-loader";

interface LoadingScreenProps {
  progress?: number;
  title?: string;
  subtitle?: string;
}

export const LoadingScreen = ({
  progress,
  title = "Forging the Realm",
  subtitle = "Summoning terrain, armies, and ancient trade routes.",
}: LoadingScreenProps) => {
  return (
    <BootLoaderShell
      mode={typeof progress === "number" && progress > 0 ? "determinate" : "indeterminate"}
      progress={progress}
      title={title}
      subtitle={subtitle}
      caption="Initializing"
    />
  );
};
