import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

type SortPanelProps = {
    children?: React.ReactNode;
} & React.ComponentPropsWithRef<'div'>

export const SortPanel = ({ children, className }: SortPanelProps) => {
    const [state, setState] = useState();

    useEffect(() => { }, []);

    return (
        <div className={clsx('flex flex-wrap border-b border-gray-gold', className)}>
            {children}
        </div>
    );
};