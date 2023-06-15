import { ReactNode } from "react";
import { BaseContainer } from "./BaseContainer";

interface BottomRightContainerProps {
    children?: ReactNode;
}

export const BottomRightContainer = ({ children }: BottomRightContainerProps) => {
    return (
        <BaseContainer className="absolute w-1/4 h-[550px] bottom-10 right-6" expandable>
            {children}
        </BaseContainer>
    );
};
