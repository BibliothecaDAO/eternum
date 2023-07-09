import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '../../../elements/tab';
import { CaravansPanel } from './trade/CaravansPanel';
import { MarketPanel } from './trade/MarketPanel';
import { FetchStatus, useGetCaravans, useGetTrades } from '../../../hooks/useGraphQLQueries';
import { MyOffersPanel } from './trade/MyOffersPanel';
import { getComponentValue } from '@latticexyz/recs';
import { useDojo } from '../../../DojoContext';
import { Utils } from '@dojoengine/core';
import useRealmStore from '../../../hooks/store/useRealmStore';
import { GetTradesQuery } from '../../../generated/graphql';

type RealmTradeComponentProps = {}

export const RealmTradeComponent = ({ }: RealmTradeComponentProps) => {

    const {components: { Trade, Status }} = useDojo();

    const [selectedTab, setSelectedTab] = useState(2);
    const [myTrades, setMyTrades] = useState<number[]>([]);
    const [counterpartyTrades, setCounterpartyTrades] = useState<number[]>([]);
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
        // TODO: how to only update when tradeData actually changes?
        if (tradeData && tradeStatus === FetchStatus.Success) {
            tradeData.entities?.forEach((entity) => {
                if (entity) {
                    let trade = getComponentValue(Trade, Utils.getEntityIdFromKeys([BigInt(parseInt(entity.keys))]));
                    let status = getComponentValue(Status, Utils.getEntityIdFromKeys([BigInt(parseInt(entity.keys))]));
                    if (trade?.maker_id === realmEntityId && status?.value === 0) {
                        console.log('my trade', parseInt(entity.keys))
                        myTrades.push(parseInt(entity.keys))
                    }
                    else if (trade?.maker_id !== realmEntityId && status?.value === 0) {
                        console.log('counterparty trade', parseInt(entity.keys))
                        counterpartyTrades.push(parseInt(entity.keys))
                    }
                }
            })
        }
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


    const tabs = useMemo(
        () => [
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>My Offers</div>
                    </div>
                ),
                component: <MyOffersPanel trades={myTrades} />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Market</div>
                    </div>
                ),
                component: <MarketPanel trades={counterpartyTrades} />,
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
                        <div>Trade Routes</div>
                    </div>
                ),
                component: <div />,
            }
        ],
        [selectedTab, myTrades, counterpartyTrades]
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