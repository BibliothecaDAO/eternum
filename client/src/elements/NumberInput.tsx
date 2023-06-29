import React from 'react';
import { ReactComponent as ArrowLeft } from '../assets/icons/common/arrow-left.svg';
import { ReactComponent as ArrowRight } from '../assets/icons/common/arrow-right.svg';

type NumberInputProps = {
    value: number;
    onChange: (value: number) => void;
    step?: number;
    className?: string;
}

export const NumberInput = ({ value, onChange, className, step = 1 }: NumberInputProps) => (
    <div className='flex items-center w-20 h-12 border rounded-lg border-gold'>
        <div className='w-[14px] border-r border-gold cursor-pointer' onClick={
            () => onChange(value - step)
        }>
            <ArrowLeft />
        </div>
        <input type='number' className='w-full h-full text-center bg-transparent text-light-pink' value={value} onChange={(e) => onChange(parseInt(e.target.value))} />
        <div className='w-[14px] border-l border-gold cursor-pointer' onClick={
            () => onChange(value + step)
        }>
            <ArrowRight />
        </div>
    </div>
);