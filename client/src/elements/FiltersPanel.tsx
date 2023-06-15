import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

type FiltersPanelProps = {
    children?: React.ReactNode;
} & React.ComponentPropsWithRef<'div'>

export const FiltersPanel = ({ children, className }: FiltersPanelProps) => {

    return (
        <div className={clsx('flex flex-wrap space-2', className)}>
            {children}
        </div>
    );
};