import clsx from 'clsx';
import React, { ComponentPropsWithRef } from 'react';

type BadgeProps = {
    children?: React.ReactNode;
    size: 'sm' | 'md' | 'lg' | 'xl';
} & ComponentPropsWithRef<'div'>

const sizes = {
    sm: 'w-2 h-2',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    xl: 'w-6 h-6',
}
export const Badge = ({ children, size, className }: BadgeProps) => (
    <div className={clsx('flex items-center justify-center border-2 border-black rounded-full bg-gold', sizes[size], className)}>{children}</div>
);