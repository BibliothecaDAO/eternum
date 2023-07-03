import clsx from 'clsx';
import React from 'react';

type BuildingsCountProps = {
    count: number;
    maxCount: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const BuildingsCount = ({ count, maxCount, className }: BuildingsCountProps) => (
    <div className={clsx('h-[2px] gap-[3px] grid w-full', className)} style={{ gridTemplateColumns: `repeat(${maxCount}, minmax(0, 1fr))` }}>
        {
            Array(maxCount).fill(0).map((_, i) => (
                <div key={i} className={`h-full ${i < count ? 'bg-gold' : 'bg-dark-brown'}`} />
            ))
        }
    </div>
);