import clsx from "clsx";
import { useMemo } from "react";

type CircleButtonProps = {
    children?: React.ReactNode,
    className?: string
    size: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
} & React.ComponentPropsWithRef<'button'>

const sizes = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-14 h-14',
}

const CircleButton = ({ children, className, size, ...props }: CircleButtonProps) => {

    return (
        <button className={clsx("flex outline-1 outline outline-gold outline-offset-2 hover:scale-105 transition-transform duration-100 cursor-pointer items-center justify-center bg-brown text-gold hover:text-white rounded-full shadow-md border border-gold shadow-black/50", className, sizes[size])} {...props}>
            {children}
        </button>
    );
};

export default CircleButton;