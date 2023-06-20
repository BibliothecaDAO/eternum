import React from 'react';

type FilterPopupProps = {
    children: React.ReactNode;
}

export const FilterPopup = ({ children }: FilterPopupProps) => {

    return (
        <div className='fixed flex flex-col -translate-y-4 translate-x-9 left-1/4'>
            {children}
        </div>
    );
};

FilterPopup.Head = ({ children }: { children: React.ReactNode }) => <div className='text-xxs relative -mb-[1px] z-20 bg-brown px-1 py-0.5 rounded-t-[4px] border-t border-x border-white text-white w-min whitespace-nowrap'> {children} </div>

FilterPopup.Body = ({ children }: { children: React.ReactNode }) => <div className='w-[438px] relative z-10 h-[280px] bg-gray border border-white rounded-tr-[4px] rounded-b-[4px]'>
    {children}
</div>