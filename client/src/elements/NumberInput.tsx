import React from 'react';
import { ReactComponent as ArrowLeft } from '../assets/icons/common/arrow-left.svg';
import { ReactComponent as ArrowRight } from '../assets/icons/common/arrow-right.svg';
import clsx from 'clsx';

type NumberInputProps = {
    value: number;
    onChange: (value: number) => void;
    step?: number;
    className?: string;
    max: number;
}

export const NumberInput = ({ value, onChange, className, step = 1, max }: NumberInputProps) => (
    <div className={clsx('flex items-center border rounded-lg w-22 h-7 border-gold', className)}>
        <div className='flex items-center justify-center h-full px-1 border-r cursor-pointer border-gold' onClick={
            () => onChange(Math.max(value - step, 0))
        }>
            <ArrowLeft />
        </div>

        <input type='number' className=' w-14 text-xs appearance-none !outline-none h-full text-center bg-transparent text-light-pink' value={value} onChange={(e) => onChange(parseInt(e.target.value))} />

        <div className='flex items-center justify-center h-full px-1 border-l cursor-pointer border-gold' onClick={
            () => onChange(Math.min(value + step, max))
        }>
            <ArrowRight />
        </div>
    </div>
);