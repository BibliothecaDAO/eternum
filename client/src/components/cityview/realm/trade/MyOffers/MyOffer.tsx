import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../../elements/OrderIcon';
import Button from '../../../../../elements/Button';
import { ResourceIcon } from '../../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../../constants/resources';
import { ReactComponent as RatioIcon } from '../../../../../assets/icons/common/ratio.svg';
import { useComponentValue } from '@dojoengine/react';
import { useDojo } from '../../../../../DojoContext';
import { Utils } from '@dojoengine/core';
import { Realm, ResourcesOffer } from '../../../../../types';
import { orderNameDict } from '../../../../../constants/orders';
import * as realmsData from '../../../../../geodata/realms.json';
import useRealmStore from '../../../../../hooks/store/useRealmStore';
import { getComponentValue } from '@latticexyz/recs';
import { MyOfferInterface, useGetTradeResources } from '../../../../../hooks/useGraphQLQueries';

type TradeOfferProps = {
    myOffer: MyOfferInterface;
}

export const MyOffer = ({ myOffer, ...props }: TradeOfferProps) => {
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setIsLoading(false);
    }, [myOffer])

    const {
        systemCalls: { change_order_status },
        components: { Trade, Status, FungibleEntities, Resource, Realm },
    } = useDojo();

    const { realmEntityId } = useRealmStore();

    // TODO: get all my offers, so need to add trade_id in the component for now because not available in torii
    let trade = useComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(myOffer.tradeId)]));


    const cancelOffer = async () => {
        // status 2 = cancel
        setIsLoading(true);
        change_order_status({ realm_id: realmEntityId, trade_id: myOffer.tradeId, new_status: 2 })
    }

    // TODO: get the maker realm
    let makerRealm: Realm | undefined;
    if (trade) {
        makerRealm = getComponentValue(Realm, Utils.getEntityIdFromKeys([BigInt(trade.maker_id)]));
    }

    const { tradeResources: { resourcesGet, resourcesGive } } = useGetTradeResources({ makerOrderId: myOffer.makerOrderId, takerOrderId: myOffer.takerOrderId });

    let timeLeft: string | undefined;
    if (trade) {
        timeLeft = formatTimeLeft(trade.expires_at - Date.now() / 1000);
    };

    return (
        <div className='flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold'>
            <div className='flex items-center justify-between'>
                {makerRealm && <div className='flex items-center p-1 -mt-2 -ml-2 border border-t-0 border-l-0 rounded-br-md border-gray-gold'>
                    {/* // order of the order maker */}
                    {makerRealm.order && <OrderIcon order={orderNameDict[makerRealm.order]} size="xs" className='mr-1' />}
                    {realmsData['features'][makerRealm.realm_id - 1].name}
                </div>}
                <div className='-mt-2 text-gold'>
                    {timeLeft}
                </div>
            </div>
            <div className='flex items-end mt-2'>
                <div className='flex items-center justify-around flex-1'>
                    <div className='grid w-1/3 grid-cols-3 gap-2 text-gold'>
                        {resourcesGive && resourcesGive.map(({ resourceId, amount }) => (
                            <div className='flex flex-col items-center'>
                                <ResourceIcon key={resourceId} resource={findResourceById(resourceId)?.trait as any} size='xs' className='mb-1' />
                                {amount}
                            </div>
                        ))}
                    </div>
                    <div className='flex flex-col items-center text-white'>
                        <RatioIcon className="mb-1 fill-white" />
                        {resourcesGive && resourcesGet && calculateRatio(resourcesGive, resourcesGet).toFixed(2)}
                    </div>
                    <div className='grid w-1/3 grid-cols-3 gap-2 text-gold'>
                        {resourcesGet && resourcesGet.map(({ resourceId, amount }) => (
                            <div className='flex flex-col items-center'>
                                <ResourceIcon key={resourceId} resource={findResourceById(resourceId)?.trait as any} size='xs' />
                                {amount}
                            </div>
                        ))}
                    </div>
                </div>
                {!isLoading && <Button onClick={() => { cancelOffer() }} variant={'danger'} className='ml-auto p-2 !h-4 text-xxs !rounded-md'>{`Cancel`}</Button>}
                {isLoading && <Button isLoading={true} onClick={() => { }} variant="danger" className='ml-auto p-2 !h-4 text-xxs !rounded-md'>{ }</Button>}
            </div>
        </div >
    );
};

const formatTimeLeft = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days} days ${hours}h:${minutes}m`;
};

const calculateRatio = (resourcesGive: ResourcesOffer[], resourcesGet: ResourcesOffer[]) => {
    let quantityGive = 0;
    for (let i = 0; i < resourcesGive.length; i++) {
        quantityGive += resourcesGive[i].amount;
    }
    let quantityGet = 0;
    for (let i = 0; i < resourcesGet.length; i++) {
        quantityGet += resourcesGet[i].amount;
    }
    return quantityGet / quantityGive;
}
