import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../elements/OrderIcon';
import Button from '../../../../elements/Button';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../constants/resources';
import { ReactComponent as Clock } from '../../../../assets/icons/common/clock.svg';
import { ReactComponent as Farm } from '../../../../assets/icons/common/farm.svg';
import { ReactComponent as Village } from '../../../../assets/icons/common/village.svg';

import ProgressBar from '../../../../elements/ProgressBar';

type LaborComponentProps = {
    resourceId: number
}

export const LaborComponent = ({ resourceId, ...props }: LaborComponentProps) => {
    const [state, setState] = useState();

    useEffect(() => { }, []);

    return (
        <div className='relative flex flex-col border rounded-md border-gray-gold text-xxs text-gray-gold'>
            <div className='absolute top-0 left-0 flex items-center px-1 italic border border-t-0 border-l-0 text-white/70 rounded-tl-md bg-black/60 rounded-br-md border-gray-gold'>
                Fish
            </div>
            <div className='grid grid-cols-6'>
                <img src={`/images/resources/${resourceId}.jpg`} className='object-cover w-full h-full rounded-md' />
                <div className='flex flex-col w-full h-full col-span-5 p-2 text-white/70'>
                    <div className='flex items-center mb-2'>
                        <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size='sm' />
                        <div className='ml-2 text-xs font-bold text-white'>5’153’423.15</div>
                        <div className='flex items-center ml-auto'>
                            <Village />
                            <div className='px-2'>2/4</div>
                            <Button variant='outline' className='px-2 py-1' onClick={() => { }}>Build</Button>
                        </div>
                    </div>
                    <ProgressBar rounded progress={75} className='bg-white' />
                    <div className='flex items-center mt-2'>
                        <Clock />
                        <div className='ml-1 italic text-white/70'>2h:15m left</div>

                        <div className='flex items-center mx-auto text-white/70'>
                            +12.5<ResourceIcon containerClassName='mx-0.5' className='!w-[12px]' resource={findResourceById(resourceId)?.trait as any} size='xs' />
                            /h
                        </div>

                        <ResourceIcon resource={findResourceById(resourceId)?.trait as any} size='xs' className='!w-[12px]' />
                        <div className='mx-1 text-brilliance'>+59,409.15</div>
                        <Button className='!px-[6px] !py-[2px] text-xxs' variant='success' onClick={() => { }}>Harvest</Button>
                    </div>
                </div>
            </div>
        </div >
    );
};