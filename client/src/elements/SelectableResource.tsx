import React from 'react';
import { findResourceById } from '../constants/resources';
import clsx from 'clsx';
import { ResourceIcon } from './ResourceIcon';
import { Tooltip } from './Tooltip';

type SelectableResourceProps = {
    resourceId: number;
    amount: number;
    selected?: boolean;
    disabled?: boolean;
} & React.HTMLAttributes<HTMLDivElement>;

export const SelectableResource = ({ resourceId, amount, selected, disabled, onClick }: SelectableResourceProps) => {

    const [showTooltip, setShowTooltip] = React.useState(false);
    const resource = findResourceById(resourceId);

    return (
        <div
            onMouseOver={
                () => setShowTooltip(true)
            }
            onMouseLeave={
                () => setShowTooltip(false)
            }
            onClick={onClick}
            className={clsx('p-3 relative cursor-pointer border border-transparent transition-colors duration-200 rounded-xl bg-black/60 hover:border-lightest',
                selected && '!border-gold',
                disabled && 'opacity-30 cursor-not-allowed pointer-events-none'
            )}
        >
            <ResourceIcon resource={resource?.trait || ''} size='xs' />
            {showTooltip && <Tooltip>
                <div className='relative z-50 flex flex-col items-center justify-center mb-1 text-xs text-center text-lightest'>
                    {resource?.trait}
                    <div className='mt-0.5 font-bold'>
                        {amount}
                    </div>
                </div>
            </Tooltip>}
        </div>
    )
};