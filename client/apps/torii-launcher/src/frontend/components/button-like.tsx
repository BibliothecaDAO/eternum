import { ReactNode } from "react";

export const ButtonLike = ({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  return (
    <div
      className={`cursor-pointer flex flex-row w-fit h-fit py-[8px] px-[12px] items-center gap-[8px] ${className} rounded text-white backdrop-blur-2xl hover:relative transition-all duration-100 ease-in-out hover:bottom-0.5 hover:shadow-[0px_2px_0px_0px_rgba(0,0,0,0.25)] select-none`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
