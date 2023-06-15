import { ReactNode } from "react";

export const TopContainer = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="absolute z-10 w-auto h-32 top-8 left-8 right-8">
            {children}
        </div>
    );
};

export default TopContainer;