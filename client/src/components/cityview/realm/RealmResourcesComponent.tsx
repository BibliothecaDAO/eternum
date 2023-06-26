import React, { useEffect, useState } from 'react';
import { ReactComponent as SkullIcon } from '../../../assets/icons/common/skull.svg';
import { ResourceIcon } from '../../../elements/ResourceIcon';
import { findResourceById } from '../../../constants/resources';
import { currencyFormat } from '../../../utils/utils.jsx';
import { useComponentValue } from "@dojoengine/react";
import clsx from 'clsx';
import { Utils } from '@dojoengine/core';
import { useDojo } from '../../../DojoContext';

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

    // TODO: retrieve the realms resources
    let realmResourceIds = [10000, 10001, 3, 4, 18, 20];
    // ATTENTION: realmEntityId != RealmId, the entityId is a random ID created by the world everytime a new entity is created (such as a realm)
    // thus you can have RealmId 1 with entityId 993 for example
    let realmEntityId = 1;

    // TODO: in contracts, change to be like previously
    // const WHEAT: u8 = 254;
    // const FISH: u8 = 255;

    const {
        components: { Resource },
      } = useDojo();

    return (
        <div className={clsx("flex h-16 space-x-4", className)}>
            <div className='flex mx-auto space-x-2'>
                {realmResourceIds.map((resourceId) => {
                    let resource = useComponentValue(Resource, Utils.getEntityIdFromKeys([BigInt(realmEntityId), BigInt(resourceId)]));
                    return (<><div className='flex flex-col' key={resourceId}>
                    <div key={resourceId} className='flex items-center p-3 text-xs font-bold text-white bg-black/60 rounded-xl h-11'>
                        <ResourceIcon resource={findResourceById(resourceId)?.trait as string} size='xs' className='mr-1' />
                        <div className="text-xs">
                            {currencyFormat(resource? resource.balance : 0)}
                        </div>
                    </div>
                    {/* TODO: resources don't have speed */}
                    {/* <div className={clsx('text-xxs mt-2 rounded-[5px] px-2 h-4 w-min',
                        resource.speed > 0 && 'text-order-vitriol bg-dark-green',
                        resource.speed < 0 && 'text-light-red bg-brown',
                        resource.speed == 0 && 'text-gold bg-brown'
                    )}>
                        {resource.speed !== 0 ? `${resource.speed}/s` : 'IDLE'}
                    </div> */}
                </div>
                    {
                        resourceId == 255 && (
                            <div className='flex items-center mx-3 -translate-y-2'>|</div>
                        )
                    }
                </>
                )})}

            </div>
        </div>
    );
};

export default RealmResourcesComponent;