import React, { Children } from 'react';

type TooltipProps = {
    children: React.ReactNode;
}

export const Tooltip = ({ children }: TooltipProps) => (
    <div className="w-[52px] absolute top-0 -translate-y-full left-1/2 -translate-x-1/2 p-2 bg-dark-brown rounded-md flex-col justify-start items-center gap-2 inline-flex">
        {children}
        <svg className='absolute bottom-0 z-0 -translate-x-1/2 translate-y-1/2 left-1/2' width="26" height="18" viewBox="0 0 26 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10.6931 16.2253C11.8927 17.6681 14.1074 17.6681 15.3069 16.2253L24.4998 5.1679C26.1248 3.21329 24.7348 0.25 22.1929 0.25H3.80708C1.26518 0.25 -0.124826 3.21329 1.50021 5.1679L10.6931 16.2253Z" fill="#54433A" />
        </svg>
    </div>
);