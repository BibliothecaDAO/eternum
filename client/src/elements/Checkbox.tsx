import clsx from 'clsx';
import React from 'react';
import { ReactComponent as Checkmark } from '../assets/icons/common/checkmark.svg';
type CheckboxProps = {
    enabled: boolean;
    disabled?: boolean;
}

export const Checkbox = ({ enabled, disabled }: CheckboxProps) => (
    <div className={clsx('w-3 h-3 flex items-center justify-center rounded-[3px] bg-dark-green-accent border transition-all duration-300 ease-in-out hover:border-white',
        enabled ? 'border-white' : 'border-gold',
    )}>
        {enabled && <Checkmark className='fill-white' />}
    </div>
);