import clsx from 'clsx';
import React, { useEffect, useState } from 'react';

type ChatTabsProps = {}

const TABS = [
    'Global Chat',
    'Guild Chat',
    'PM'
]
export const ChatTabs = ({ }: ChatTabsProps) => {
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => { }, []);
    const delimiter = '•'
    return (
        <div className='flex p-2 text-xs'>
            {TABS.map((tab, index) => {
                return (
                    <div key={index} className='flex items-center leading-tight'>
                        <button
                            onClick={() => setActiveTab(index)}
                            className={clsx('transition-colors duration-200', activeTab == index ? 'text-white' : 'text-gold cursor-pointer hover:text-white/70 underline underline-offset-2')}>
                            {tab}
                        </button>
                        {index !== TABS.length - 1 && <div className='mx-2 text-white'>{delimiter}</div>}
                    </div>)
            })}
        </div>
    );
};