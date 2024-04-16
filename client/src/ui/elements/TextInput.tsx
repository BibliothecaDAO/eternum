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

const TextInput = (props: TextInputProps) => {
  const { value, disabled, onChange, className, placeholder, maxLength, onBlur, onFocus, onKeyDown, onKeyPress } =
    props;
  return (
    <input
      className={clsx(
        "w-full p-2 h-8 bg-transparent transition-all duration-300 focus:outline-none border-opacity-50 focus:border-opacity-100  placeholder-white/25 flex-grow uppercase",
        className,
      )}
      disabled={disabled || false}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
