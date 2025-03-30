import clsx from "clsx";

export const LoadingOroborus = ({ loading }: { loading: boolean }) => {
  return (
    <div
      className={clsx(
        "absolute bottom-0 left-0 z-20 w-full pointer-events-none flex items-center  justify-center text-3xl h-full bg-brown duration-300 transition-opacity",
        loading ? "opacity-100" : "opacity-0",
      )}
    >
      <img src="/images/logos/eternum-animated.png" className="invert scale-50" />
    </div>
  );
};
