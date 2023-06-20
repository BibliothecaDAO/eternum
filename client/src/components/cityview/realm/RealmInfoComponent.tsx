import React, { useEffect, useState } from 'react';
import { ResourceIcon } from '../../../elements/ResourceIcon';
import { findResourceById } from '../../../constants/resources';
import { OrderIcon } from '../../../elements/OrderIcon';

type RealmInfoComponentProps = {}

export const RealmInfoComponent = ({ }: RealmInfoComponentProps) => {

    return (
        <>
            <div className="relative text-sm shadow-lg shadow-black/25 flex items-center px-4 py-2 text-white h-[50px] bg-crimson">
                <div className='flex flex-col leading-4'>
                    <div className="font-bold">
                        Miliadea
                    </div>
                    <div className="text-xxs text-gold">
                        0x...loaf
                    </div>
                </div>
                <div className='flex items-center ml-auto'>
                    Anger
                    <OrderIcon order='anger' size="sm" color='white' />
                </div>
            </div>
        </>
    );
};

export default RealmInfoComponent;