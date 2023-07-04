import React from 'react';
import { ReactComponent as HeadlineLeft } from '../assets/icons/common/headline-left.svg';
import { ReactComponent as HeadlineRight } from '../assets/icons/common/headline-right.svg';
import clsx from 'clsx';

type HeadlineProps = {
    children: React.ReactNode;
    className?: string;
}

export const Headline = ({ children, className }: HeadlineProps) => (
    <div className={clsx('flex items-center justify-center select-none', className)}>
        <HeadlineLeft />
        <div className='mx-3 text-xs font-bold text-white whitespace-nowrap'>
            {children}
        </div>
        <HeadlineRight />
    </div>
);