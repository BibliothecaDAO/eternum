import Button from "@/ui/elements/Button";
import React, { useState } from "react";
import clsx from "clsx"; // Import clsx

type ToggleComponentProps = {
  title: string;
  children: React.ReactNode;
  props?: any;
};

export const ToggleComponent = ({ title, children, props }: ToggleComponentProps) => {
  const [isToggled, setIsToggled] = useState(false);

  const toggleList = () => {
    setIsToggled(!isToggled);
  };

  return (
    <div className="w-full" {...props}>
      <Button onClick={toggleList} className="mt-2 w-full transition-all duration-200" variant="outline">
        {title}
      </Button>
      <div
        className={clsx(
          "transition-max-height duration-300 ease-in-out overflow-hidden",
          isToggled ? "max-h-[500px] visible" : "max-h-0 invisible",
        )}
      >
        <div>{children}</div>
      </div>
    </div>
  );
};
