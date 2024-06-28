import clsx from "clsx";

interface TextInputProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  onBlur?: (e: any) => void;
  onFocus?: (e: any) => void;
  onKeyDown?: (e: any) => void;
  onKeyPress?: (e: any) => void;
}
const formatNumber = (value: string) => {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const TextInput = (props: TextInputProps) => {
  const { value, disabled, onChange, className, placeholder, maxLength, onBlur, onFocus, onKeyDown, onKeyPress } =
    props;
  return (
    <input
      className={clsx(
        "w-full p-2 transition-all duration-300 focus:outline-none  border-opacity-50 focus:border-opacity-100  placeholder-white/25 flex-grow  bg-transparent border border-gold/40 rounded-sm font-bold",
        className,
      )}
      disabled={disabled || false}
      type="text"
      value={formatNumber(value)}
      onChange={(e) => onChange(e.target.value.replace(/,/g, ""))}
      placeholder={placeholder}
      maxLength={maxLength}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onKeyPress={onKeyPress}
    />
  );
};

export default TextInput;
