import React, { useEffect, useState } from 'react';
import { ReactComponent as SkullIcon } from '../../../assets/icons/common/skull.svg';
import { ResourceIcon } from '../../../elements/ResourceIcon';
import { findResourceById } from '../../../constants/resources';
import { currencyFormat } from '../../../utils/utils.jsx';
import clsx from 'clsx';

type RealmResourcesComponentProps = {} & React.ComponentPropsWithRef<'div'>

const dummyResources = [
    {
        resourceId: 10000,
        amount: 54000,
        speed: -555
    },
    {
        resourceId: 10001,
        amount: 87000,
        speed: -235
    },
    {
        resourceId: 3,
        amount: 150,
        speed: -5
    },
    {
        resourceId: 4,
        amount: 32,
        speed: 11
    },
    {
        resourceId: 18,
        amount: 120,
        speed: -12
    },
    {
        resourceId: 20,
        amount: 4,
        speed: 0
    }
]

export const RealmResourcesComponent = ({ className }: RealmResourcesComponentProps) => {

    return (
        <div className={clsx("flex h-16 space-x-4", className)}>
            <div className='flex mx-auto space-x-2'>
                {dummyResources.map((resource) => (<><div className='flex flex-col' key={resource.resourceId}>
                    <div key={resource.resourceId} className='flex items-center p-3 text-xs font-bold text-white bg-black/60 rounded-xl h-11'>
                        <ResourceIcon resource={findResourceById(resource.resourceId)?.trait as string} size='xs' className='mr-1' />
                        <div className="text-xs">
                            {currencyFormat(resource.amount)}
                        </div>
                    </div>
                    <div className={clsx('text-xxs mt-2 rounded-[5px] px-2 h-4 w-min',
                        resource.speed > 0 && 'text-order-vitriol bg-dark-green',
                        resource.speed < 0 && 'text-light-red bg-brown',
                        resource.speed == 0 && 'text-gold bg-brown'
                    )}>
                        {resource.speed !== 0 ? `${resource.speed}/s` : 'IDLE'}
                    </div>
                </div>
                    {
                        resource.resourceId == 10001 && (
                            <div className='flex items-center mx-3 -translate-y-2'>|</div>
                        )
                    }
                </>
                ))}

            </div>
        </div>
    );
};

export default RealmResourcesComponent;