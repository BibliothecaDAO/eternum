type RangeInputProps = {
  title: string;
  fromTitle?: string;
  toTitle?: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  className?: string;
  min?: number;
  max?: number;
};

export const RangeInput = ({
  title,
  fromTitle = "Min.",
  toTitle = "Max.",
  value,
  onChange,
  step = 1,
  max = 100,
  min = 0,
}: RangeInputProps) => (
  <div className="flex flex-col w-full">
    <div className="text-xxs text-gray-gold italic mb-1">{title}</div>
    <input
      type="range"
      min={min}
      className="w-full accent-gold border-gold dark:bg-dark-wood"
      value={value}
      step={step}
      max={max}
      onChange={(e) => onChange(parseInt(e.target.value))}
    />
    <div className="flex justify-between text-xxs text-gold mt-0.5">
      <div>{fromTitle}</div>
      <div>{toTitle}</div>
    </div>
  </div>
);
