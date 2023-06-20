import clsx from "clsx";

interface ProgressBarProps {
    progress: number;
    children?: React.ReactNode;
    className?: string;
}
const ProgressBar = ({ progress, children, className }: ProgressBarProps) => {
    return (
        <div className="w-full h-0.5 bg-white/20">
            <div className={clsx("flex items-center justify-center h-0.5 text-[10px] text-white bg-[#33FF00]", className)} style={{ width: `${progress}%` }}>
                {children}
            </div>
        </div>
    );
};

export default ProgressBar;