import { BootLoaderShell } from "@/ui/modules/boot-loader";

export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  if (!loading) {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 top-0 z-[10000] h-screen w-screen pointer-events-none">
      <BootLoaderShell
        className="absolute inset-0"
        panelClassName="max-w-[30rem] px-6 py-7"
        title="Charting the World"
        subtitle="Reading contour lines and preparing the next handoff."
        caption="Transition"
      />
    </div>
  );
};
