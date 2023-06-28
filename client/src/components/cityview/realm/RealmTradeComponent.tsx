import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from '../../../elements/tab';
import { CaravansPanel } from './trade/CaravansPanel';
import { MarketPanel } from './trade/MarketPanel';
import { FetchStatus, useGetCaravans, useGetTrades } from '../../../hooks/useGraphQLQueries';

type RealmTradeComponentProps = {}

export const RealmTradeComponent = ({ }: RealmTradeComponentProps) => {

    const [selectedTab, setSelectedTab] = useState(2);

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
                component: <div />,
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
                        <div>Trade Routes</div>
                    </div>
                ),
                component: <div />,
            }
        ],
        [selectedTab]
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