import { ReactNode } from "react";
import clsx from 'clsx'

interface SecondaryContainerProps {
    children?: ReactNode;
    className?: string;
}

export const SecondaryContainer = ({ children, className }: SecondaryContainerProps) => {
    return (
        <div className={clsx("p-2 flex shadow-black/30 shadow-md flex-col border-1 border-white/20 border-solid rounded-xl  container-bg-gradient-secondary backdrop-blur-sm overflow-hidden", className)}>
            {children}
        </div>
    );
};
