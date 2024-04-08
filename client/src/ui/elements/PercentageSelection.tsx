import clsx from "clsx";
import Button from "./Button";

type PercentageSelectionProps = {
  className?: string;
  percentages: number[];
  setPercentage: (percentage: number) => void;
};

export const PercentageSelection = ({ className = "", percentages, setPercentage }: PercentageSelectionProps) => {
  return (
    <div className={clsx("w-[80%] flex flex-row items-center justify-center", className)}>
      {percentages.map((percentage, i) => (
        <Button key={i} variant={"outline"} className={"!p-1 my-2 mr-3 w-20"} onClick={() => setPercentage(percentage)}>
          {`${percentage}%`}
        </Button>
      ))}
    </div>
  );
};
