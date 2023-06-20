import React, { useEffect, useState } from 'react';

type BaseStatusProps = {
    state: 'bad' | 'neutral' | 'good'
    children?: React.ReactNode
}

const STYLES = {
    base: 'flex items-center justify-center px-3 py-2 ml-auto text-xs text-white rounded-full cursor-default h-7',
    bad: ' bg-light-red',
    neutral: 'bg-yellow-500',
    good: 'bg-order-vitriol',
}
export const BaseStatus = ({ state, children }: BaseStatusProps) => {

    useEffect(() => { }, []);

    return (
        <div className={`${STYLES.base} ${STYLES[state]}`}>
            {children}
        </div>
    );
};