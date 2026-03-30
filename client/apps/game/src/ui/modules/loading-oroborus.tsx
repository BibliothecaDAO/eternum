import clsx from "clsx";

import { BootLoaderShell } from "@/ui/modules/boot-loader";

export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 right-0 top-0 z-[10000] w-screen h-screen pointer-events-none duration-300 transition-opacity",
        loading ? "opacity-100" : "opacity-0",
      )}
    >
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
