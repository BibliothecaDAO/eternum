import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from '../../../elements/tab';
import { LaborPanel } from './labor/LaborPanel';

type RealmLaborComponentProps = {}

export const RealmLaborComponent = ({ }: RealmLaborComponentProps) => {

    const [selectedTab, setSelectedTab] = useState(0);

    const tabs = useMemo(
        () => [
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Resources</div>
                    </div>
                ),
                component: <LaborPanel />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Buildings</div>
                    </div>
                ),
                component: <div />,
            },
            {
                label: (
                    <div className="flex flex-col items-center">
                        <div>Tools</div>
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
                onChange={(index: any) => setSelectedTab(index as number)}
                variant="default"
                className='h-full'
            >
                <Tabs.List>
                    {tabs.map((tab, index) => (
                        <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                    ))}
                </Tabs.List>
                <Tabs.Panels className='overflow-hidden'>
                    {tabs.map((tab, index) => (
                        <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
                    ))}
                </Tabs.Panels>
            </Tabs>
        </>
    );
};

export default RealmLaborComponent;