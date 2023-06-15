import { ReactNode } from "react";
import clsx from 'clsx'
import { ReactComponent as Expand } from '../assets/icons/common/expand.svg';

interface BaseContainerProps {
    children?: ReactNode;
    className?: string;
    expandable?: boolean;
}

export const BaseContainer = ({ children, className, expandable }: BaseContainerProps) => {
    return (
        <div className={clsx("p-2 flex shadow-black/30 shadow-md flex-col border border-gold rounded-xl  container-bg-gradient overflow-hidden", className)}>
            {children}
            {expandable && <Expand className="absolute w-4 h-4 transition-colors duration-200 cursor-pointer top-4 right-4 fill-gold hover:fill-white" />}
        </div>
    );
};
