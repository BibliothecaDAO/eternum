import { useMemo, useState } from "react";
import { BaseContainer } from "../../../containers/BaseContainer"
import { SecondaryContainer } from "../../../containers/SecondaryContainer"
import { ReactComponent as CrossSwords } from '../../../assets/icons/common/cross-swords.svg';
import { ReactComponent as PickAxeSecond } from '../../../assets/icons/common/pick-axe-second.svg';
import { ReactComponent as Coin } from '../../../assets/icons/common/coin.svg';
import { ReactComponent as City } from '../../../assets/icons/common/city.svg';
import { ReactComponent as Map } from '../../../assets/icons/common/map.svg';

import { Tabs } from "../../../elements/tab";
import RealmTradeComponent from "./RealmTradeComponent";
import RealmLaborComponent from "./RealmLaborComponent";


const RealmManagementComponent = () => {
    const [selectedTab, setSelectedTab] = useState(1);

    const tabs = useMemo(
        () => [
            {
                label: (
                    <div className="flex items-center">
                        <PickAxeSecond className="mr-2 fill-current" />{' '}
                        <div>Labor</div>
                    </div>
                ),
                component: <RealmLaborComponent />,
            },
            {
                label: (
                    <div className="flex items-center">
                        <Coin className="mr-2 fill-current" />{' '}
                        <div>Trade</div>
                    </div>
                ),
                component: <RealmTradeComponent />,
            }
        ],
        [selectedTab]
    );
    return (
        <>
            <Tabs
                selectedIndex={selectedTab}
                onChange={(index) => setSelectedTab(index as number)}
                variant="primary"
                className="flex-1 mt-[6px] overflow-hidden"
            >
                <Tabs.List>
                    {tabs.map((tab, index) => (
                        <Tabs.Tab key={index}>{tab.label}</Tabs.Tab>
                    ))}
                </Tabs.List>
                <Tabs.Panels className="overflow-hidden">
                    {tabs.map((tab, index) => (
                        <Tabs.Panel key={index}>{tab.component}</Tabs.Panel>
                    ))}
                </Tabs.Panels>
            </Tabs>
            <button className="absolute flex items-center hover:bg-gold/20 transition-bg duration-200 z-10 px-2 py-1 ml-auto text-xxs border rounded-md right-3 top-[3.9rem] text-gold border-gold">
                <Map className='mr-1 fill-current' />
                Show on map
            </button>
        </>

    )
}

export default RealmManagementComponent