import React, { useMemo } from 'react';
import { findResourceById } from '../constants/resources';
import { ResourceIcon } from './ResourceIcon';
import clsx from 'clsx';

type ResourceCostProps = {
    resourceId: number;
    amount: number;
    color?: string;
}

export const ResourceCost = ({ ...props }: ResourceCostProps) => {
    const trait = useMemo(() => findResourceById(props.resourceId)?.trait, [props.resourceId])
    return (
        <div className="relative flex flex-row items-center justify-start w-full gap-1 px-1 rounded">
            <ResourceIcon resource={trait || ''} size='xs' />
            <div className="relative flex flex-col text-lightest shrink-0">
                <div className={clsx("relative text-xs font-bold", props.color)}>
                    {(props.color && props.amount > 0) ? '+' : ''}
                    {(props.color && props.amount < 0) ? '-' : ''}
                    {props.amount}
                </div>
                <div className="text-xxs leading-[10px] self-start relative">
                    {trait}
                </div>
            </div>
        </div>
    )
};