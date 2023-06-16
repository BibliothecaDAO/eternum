import React from 'react';

type FilterPopupProps = {
    children: React.ReactNode;
}

export const FilterPopup = ({ children }: FilterPopupProps) => {

    return (
        <div className='fixed flex flex-col translate-x-6 -translate-y-4 left-1/4'>
            {children}
        </div>
    );
};

FilterPopup.Head = ({ children }: { children: React.ReactNode }) => <div className='text-xxs relative -mb-[1px] z-20 bg-brown px-1 py-0.5 rounded-t-[4px] border-t border-x border-white text-white w-min whitespace-nowrap'> {children} </div>

FilterPopup.Body = ({ children }: { children: React.ReactNode }) => <div className='w-[438px] relative z-10 bg-gray border flex flex-col border-white rounded-tr-[4px] rounded-b-[4px]'>
    {children}
</div>