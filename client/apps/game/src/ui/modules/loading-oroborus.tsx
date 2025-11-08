import clsx from "clsx";

export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 right-0 top-0 z-[10000] w-screen h-screen pointer-events-none flex items-center  justify-center text-3xl !bg-black/95 panel-wood panel-wood-corners duration-300 transition-opacity",
        loading ? "opacity-100" : "opacity-0",
      )}
    >
      <img src="/images/logos/eternum-loader.png" className="w-32 sm:w-24 lg:w-24 xl:w-28 2xl:mt-2 mx-auto my-8" />
    </div>
  );
};
