import clsx from "clsx";
import React, { useMemo } from "react";

type StepsProps = {
  step: number;
  maxStep: number;
} & React.HTMLAttributes<HTMLDivElement>;

export const Steps = ({ step, maxStep, className }: StepsProps) => {
  const _step = useMemo(() => step - 1, [step]);

  return (
    <div className={clsx("flex justify-center items-center", className)}>
      {Array.from(Array(maxStep).keys()).map((i, index) => (
        <>
          <div
            key={index}
            className={clsx(
              "w-2 h-2 rounded-full",
              i == _step ? "bg-gold" : "bg-dark-brown",
              i < _step ? "!bg-brilliance" : "",
            )}
          />
          {i < maxStep - 1 && (
            <div
              key={index + 100}
              className={clsx(
                "w-6 h-[1px] mx-1",
                i < _step ? "bg-gold" : "bg-dark-brown",
                i < _step ? "!bg-brilliance" : "",
              )}
            />
          )}
        </>
      ))}
    </div>
  );
};
