// Description: Background container
// Full width and full height background container


import clsx from "clsx";
import { ReactNode } from "react";

interface BottomNavigationProps {
    children: ReactNode;
    className?: string;
}

export const Background = ({ children, className }: BottomNavigationProps) => {
    return (
        <div className={clsx("z-0 w-full h-full", className)}>
            {children}
        </div>
    );
};
