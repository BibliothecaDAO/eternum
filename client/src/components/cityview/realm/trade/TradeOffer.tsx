import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../elements/OrderIcon';
import Button from '../../../../elements/Button';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../constants/resources';
import { ReactComponent as RatioIcon } from '../../../../assets/icons/common/ratio.svg';

type ResourcesOffer = {
    resourceId: number;
    amount: number;
}
type TradeOfferProps = {
    offerId: number;
    resourcesGive: ResourcesOffer[];
    resourcesGet: ResourcesOffer[];
    timeLeft: number;
    ratio: number;
    realm: {
        id: number;
        name: string;
        order: string;
    }
}

export const TradeOffer = ({ ...props }: TradeOfferProps) => {
    const [state, setState] = useState();

    useEffect(() => { }, []);

    return (
        <div className='flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold'>
            <div className='flex items-center justify-between'>
                <div className='flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold'>
                    <OrderIcon order={props.realm.order} size="xs" className='mr-1' />
                    {props.realm.name}
                </div>
                <div className='-mt-2 text-gold'>
                    {props.timeLeft}s
                </div>
            </div>
            <div className='flex items-end mt-2'>
                <div className='flex items-center justify-around flex-1'>
                    <div className='grid w-1/3 grid-cols-3 gap-2 text-gold'>
                        {props.resourcesGive.map(({ resourceId, amount }) => (
                            <div className='flex flex-col items-center'>
                                <ResourceIcon key={resourceId} resource={findResourceById(resourceId)?.trait as any} size='xs' className='mb-1' />
                                {amount}
                            </div>
                        ))}
                    </div>
                    <div className='flex flex-col items-center text-white'>
                        <RatioIcon className="mb-1 fill-white" />
                        1.00
                    </div>
                    <div className='grid w-1/3 grid-cols-3 gap-2 text-gold'>
                        {props.resourcesGet.map(({ resourceId, amount }) => (
                            <div className='flex flex-col items-center'>
                                <ResourceIcon key={resourceId} resource={findResourceById(resourceId)?.trait as any} size='xs' />
                                {amount}
                            </div>

                        ))}
                    </div>
                </div>
                <Button onClick={() => { }} variant='success' className='ml-auto p-2 !h-4 text-xxs !rounded-md'>Accept</Button>
            </div>
        </div >
    );
};