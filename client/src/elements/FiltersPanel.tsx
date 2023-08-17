import clsx from 'clsx';
import React from 'react';

type FiltersPanelProps = {
    children?: React.ReactNode;
} & React.ComponentPropsWithRef<'div'>

export const FiltersPanel = ({ children, className }: FiltersPanelProps) => {

    return (
        <div className={clsx('flex flex-wrap space-x-1', className)}>
            {children}
        </div>
    );
};