import clsx from "clsx";

interface ProgressBarProps {
  progress: number;
  children?: React.ReactNode;
  className?: string;
  containerClassName?: string;
  rounded?: boolean;
}
const ProgressBar = ({ progress, children, className, rounded, containerClassName }: ProgressBarProps) => {
  return (
    <div className={clsx("w-full h-0.5 bg-white/20", containerClassName, rounded && "rounded-full")}>
      <div
        className={clsx(
          "flex items-center justify-center h-0.5 text-[10px] text-white bg-[#33FF00]",
          className,
          rounded && "rounded-full",
        )}
        style={{ width: `${progress}%` }}
      >
        {children}
      </div>
    </div>
  );
};

export default ProgressBar;
