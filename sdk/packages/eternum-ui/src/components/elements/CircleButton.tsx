import clsx from "clsx";

type CircleButtonProps = {
  children?: React.ReactNode;
  className?: string;
  size: "xs" | "sm" | "md" | "lg" | "xl";
} & React.ComponentPropsWithRef<"button">;

const sizes = {
  xs: "w-6 h-6",
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-14 h-14",
};

const CircleButton = ({
  children,
  className,
  size,
  ...props
}: CircleButtonProps) => {
  return (
    <button
      className={clsx(
        "flex outline-1 outline outline-gold hover:scale-105 transition-transform duration-100 cursor-pointer items-center justify-center text-gold hover:text-white rounded-full shadow-md border-4 border-black shadow-black/50",
        className,
        sizes[size],
      )}
      style={{
        backgroundImage:
          "radial-gradient(50% 50.00% at 50% 0.00%, rgba(255, 255, 255, 0.20) 0%, rgba(255, 255, 255, 0.00) 100%), linear-gradient(180deg, #4B413C 0%, #24130A 100%)",
      }}
      {...props}
    >
      {children}
    </button>
  );
};

export default CircleButton;
