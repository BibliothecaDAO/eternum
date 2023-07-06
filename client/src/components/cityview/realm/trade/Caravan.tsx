import React, { useEffect, useState } from 'react';
import { OrderIcon } from '../../../../elements/OrderIcon';
import Button from '../../../../elements/Button';
import { ResourceIcon } from '../../../../elements/ResourceIcon';
import { findResourceById } from '../../../../constants/resources';
import { ReactComponent as Pen } from '../../../../assets/icons/common/pen.svg';
import { ReactComponent as Clock } from '../../../../assets/icons/common/clock.svg';
import { ReactComponent as CaretDownFill } from '../../../../assets/icons/common/caret-down-fill.svg';
import { ReactComponent as DonkeyIcon } from '../../../../assets/icons/units/donkey.svg';
import { ReactComponent as PremiumIcon } from '../../../../assets/icons/units/premium.svg';


import ProgressBar from '../../../../elements/ProgressBar';
import { Dot } from '../../../../elements/Dot';
import clsx from 'clsx';
import { useDojo } from '../../../../DojoContext';
import { CaravanMember, Order, Resource, ResourcesOffer, Trade } from '../../../../types';
import { useComponentValue } from '@dojoengine/react';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../../hooks/store/useRealmStore';
import useBlockchainStore from '../../../../hooks/store/useBlockchainStore';
import { formatSecondsLeftInDaysHours } from '../labor/laborUtils';
import { getOrderIdsFromTrade, getRealmIdByPosition, getRealmNameById, getRealmOrderNameById, getResourceIdsFromFungibleEntities, getTotalResourceWeight } from './TradeUtils';
import { getComponentValue } from '@latticexyz/recs';

type CaravanProps = {
    tradeId: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Caravan = ({ tradeId, ...props }: CaravanProps) => {
    const [state, setState] = useState();

    const {realmEntityId} = useRealmStore();

    const {
        components: { Caravan, Quantity, Capacity, ForeignKey, Trade, ArrivalTime, FungibleEntities, Resource, Position, CaravanMembers },
    } = useDojo();

    const {nextBlockTimestamp} = useBlockchainStore();

    let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(tradeId)]));
    const {realmOrderId, counterpartyOrderId} = (trade && realmEntityId !== undefined) && getOrderIdsFromTrade(trade, realmEntityId) || {realmOrderId: 0, counterpartyOrderId: 0};
    let arrivalTime = getComponentValue(ArrivalTime, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));

    let caravanID = getComponentValue(Caravan, Utils.getEntityIdFromKeys([BigInt(realmOrderId), BigInt(realmEntityId)]))?.caravan_id || 0;
    const fungibleEntitiesGive = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));
    const fungibleEntitiesGet = getComponentValue(FungibleEntities, Utils.getEntityIdFromKeys([BigInt(counterpartyOrderId)]));

    let resourceEntityIdsGive = getResourceIdsFromFungibleEntities(realmOrderId, fungibleEntitiesGive?.key || 0, fungibleEntitiesGive?.count || 0);
    let resourceEntityIdsGet = getResourceIdsFromFungibleEntities(realmOrderId, fungibleEntitiesGet?.key || 0, fungibleEntitiesGet?.count || 0);
    let resourcesGive: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGive.length; i++) {
        resourcesGive.push(getComponentValue(Resource, resourceEntityIdsGive[i]) ?? {resource_type: 0, balance: 0});
    }
    let resourcesGet: Resource[] = [];
    for (let i = 0; i < resourceEntityIdsGet.length; i++) {
        resourcesGet.push(getComponentValue(Resource, resourceEntityIdsGet[i]) ?? {resource_type: 0, balance: 0});
    }

    // capacity
    let resourceWeight = getTotalResourceWeight([...resourcesGive, ...resourcesGet]);
    let caravanCapacity = getComponentValue(Capacity, Utils.getEntityIdFromKeys([BigInt(caravanID)]))?.weight_gram || 0;

    let position = useComponentValue(Position, Utils.getEntityIdFromKeys([BigInt(realmOrderId)]));

    const realmId = position && getRealmIdByPosition(position);
    const realmName = realmId && getRealmNameById(realmId);

    const isTravelling = nextBlockTimestamp && arrivalTime && (arrivalTime.arrives_at > nextBlockTimestamp);

    useEffect(() => { }, []);

    return (
        <div className={clsx('flex flex-col p-2 border rounded-md border-gray-gold text-xxs text-gray-gold', props.className)} onClick={props.onClick}>
            <div className='flex items-center text-xxs'>
                <div className='flex items-center p-1 -mt-2 -ml-2 italic border border-t-0 border-l-0 text-light-pink rounded-br-md border-gray-gold'>
                    #{caravanID}
                </div>
                {isTravelling && realmName && <div className='flex items-center ml-1 -mt-2'>
                    <span className='italic text-light-pink'>
                        Traveling to
                    </span>
                    <div className='flex items-center ml-1 mr-1 text-gold'>
                        <OrderIcon order={getRealmOrderNameById(realmId)} className='mr-1' size='xs' />
                        {realmName}
                    </div>
                    <span className='italic text-light-pink'>
                        with
                    </span>
                    {resourceWeight && caravanCapacity && <div className='flex items-center ml-1 text-gold'>
                        {resourceWeight}
                        <div className='mx-0.5 italic text-light-pink'>
                            /
                        </div>
                        {caravanCapacity}
                        <CaretDownFill className='ml-1 fill-current' />
                    </div>}
                </div>}
                {nextBlockTimestamp && !arrivalTime && <div className='flex ml-auto -mt-2 italic text-gold'>
                    Waiting departure <Pen className="ml-1 fill-gold" />
                </div>}
                {nextBlockTimestamp && arrivalTime && arrivalTime.arrives_at <= nextBlockTimestamp && <div className='flex ml-auto -mt-2 italic text-gold'>
                    Idle <Pen className="ml-1 fill-gold" />
                </div>}
                {isTravelling && arrivalTime && <div className='flex ml-auto -mt-2 italic text-light-pink'>
                    {formatSecondsLeftInDaysHours(arrivalTime.arrives_at - nextBlockTimestamp)}
                </div>}
            </div>
            <div className='flex mt-2'>
                <div className='grid w-full grid-cols-2 gap-5'>
                    <div className='flex flex-col'>
                        <div className='grid grid-cols-12 gap-0.5'>
                            {/* <ProgressBar className="bg-orange" containerClassName='col-span-1' rounded progress={0} /> */}
                            {/* <ProgressBar className='bg-red' containerClassName='col-span-3' rounded progress={0} /> */}
                            <ProgressBar containerClassName='col-span-12' rounded progress={100} />
                        </div>
                        <div className='flex items-center justify-between mt-[6px] text-xxs'>
                            <DonkeyIcon />
                            <div className='flex items-center space-x-[6px]'>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-green' />
                                    {/* // TODO: get number in the caravan */}
                                    <div className='mt-1 text-green'>30</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-yellow' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-orange' />
                                    <div className='mt-1 text-orange'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-red' />
                                    <div className='mt-1 text-red'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-light-pink' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-col'>
                        <div className='grid grid-cols-12 gap-0.5'>
                            <ProgressBar className="bg-orange" containerClassName='col-span-1' rounded progress={100} />
                            <ProgressBar className='bg-red' containerClassName='col-span-3' rounded progress={100} />
                            <ProgressBar containerClassName='col-span-8' rounded progress={100} />
                        </div>
                        <div className='flex items-center justify-between mt-[6px] text-xxs'>
                            <PremiumIcon />
                            <div className='flex items-center space-x-[6px]'>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-green' />
                                    <div className='mt-1 text-green'>30</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-yellow' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-orange' />
                                    <div className='mt-1 text-orange'>5</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-red' />
                                    <div className='mt-1 text-red'>10</div>
                                </div>
                                <div className='flex flex-col items-center'>
                                    <Dot colorClass='bg-light-pink' />
                                    <div className='mt-1 text-dark'>0</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    );
};