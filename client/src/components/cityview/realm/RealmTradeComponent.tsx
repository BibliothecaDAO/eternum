import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '../../../elements/tab';
import { CaravansPanel } from './trade/Caravans/CaravansPanel';
import { MarketPanel } from './trade/Market/MarketPanel';
import { FetchStatus, useGetCaravans, useGetTrades } from '../../../hooks/useGraphQLQueries';
import { MyOffersPanel } from './trade/MyOffers/MyOffersPanel';
import { getComponentValue } from '@latticexyz/recs';
import { useDojo } from '../../../DojoContext';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../hooks/store/useRealmStore';
import { IncomingOrdersPanel } from './trade/Caravans/IncomingCaravansPanel';

export type Order = {
    orderId: number,
    counterpartyOrderId: number,
    tradeId: number
}

type RealmTradeComponentProps = {}

export const RealmTradeComponent = ({ }: RealmTradeComponentProps) => {

    const {components: { Trade, Status }} = useDojo();

    const [selectedTab, setSelectedTab] = useState(2);
    const [myTrades, setMyTrades] = useState<number[]>([]);
    const [counterpartyTrades, setCounterpartyTrades] = useState<number[]>([]);
    const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
    const {realmEntityId} = useRealmStore();

    const {data: tradeData, status: tradeStatus} = useGetTrades();
    // TODO: find a better way to parse this
    let trades: number[] = [];
    if (tradeData && tradeStatus === FetchStatus.Success) {
        tradeData.entities?.forEach((entity) => {
            if (entity) {
                trades.push(parseInt(entity.keys))
            }
        })
    }

    useEffect(() => {
        let myTrades: number[] = [];
        let counterpartyTrades: number[] = [];
        let incomingOrders: {orderId: number, counterpartyOrderId: number, tradeId: number}[] = [];
        // TODO: how to only update when tradeData actually changes?
        if (tradeData && tradeStatus === FetchStatus.Success) {
            tradeData.entities?.forEach((entity) => {
                if (entity) {
                    let tradeId = parseInt(entity.keys);
                    let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(tradeId)]));
                    let status = getComponentValue(Status, Utils.getEntityIdFromKeys([BigInt(tradeId)]));
                    if (trade?.maker_id === realmEntityId && status?.value === 0) {
                        myTrades.push(tradeId)
                    }
                    else if (trade?.maker_id !== realmEntityId && status?.value === 0) {
                        counterpartyTrades.push(tradeId)
                    // status 1 = accepted
                    // if you are maker, then check if the order coming your way has been claimed yet
                    } else if ((trade?.maker_id === realmEntityId && Number(trade.claimed_by_maker) !== 1) && status?.value === 1) {
                        incomingOrders.push({orderId: trade.taker_order_id, counterpartyOrderId: trade.maker_order_id, tradeId});

                    } else if (trade && (trade.taker_id === realmEntityId && Number(trade.claimed_by_taker) !== 1) && status?.value === 1) {
                        incomingOrders.push({orderId: trade.maker_order_id, counterpartyOrderId: trade.taker_order_id, tradeId});
                    }
                }
            })
        }
        setIncomingOrders(incomingOrders);
        setMyTrades(myTrades);
        setCounterpartyTrades(counterpartyTrades);
    }, [tradeData, realmEntityId]);

    const {data: caravanData, status: caravanStatus} = useGetCaravans();
    // TODO: find a better way to parse this
    let caravans: number[] = [];
    if (caravanData && caravanStatus === FetchStatus.Success) {
        caravanData.entities?.forEach((entity) => {
            if (entity) {
                caravans.push(parseInt(entity.keys))
            }
        })
    }

    // TODO: get my trades + get market trades should be 2 queries

    const tabs = useMemo(
        () => [
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>My Offers</div>
                    </div>
                ),
                component: <MyOffersPanel />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Market</div>
                    </div>
                ),
                component: <MarketPanel />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Caravans</div>
                    </div>
                ),
                component: <CaravansPanel />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div> Incoming Caravans </div>
                    </div>
                ),
                component: <IncomingOrdersPanel orders={incomingOrders} />,
            }
        ],
        [selectedTab, myTrades, counterpartyTrades, incomingOrders]
    );

    return (
        <>
            <Tabs
                selectedIndex={selectedTab}
                onChange={(index) => setSelectedTab(index as number)}
                variant="default"
                className='h-full'
            >
                <Tabs.List>
                    {tabs.map((tab, index) => (
                        <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                    ))}
                </Tabs.List>
                <Tabs.Panels>
                    {tabs.map((tab, index) => (
                        <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
                    ))}
                </Tabs.Panels>
            </Tabs>
        </>
    );
};

export default RealmTradeComponent;