import clsx from "clsx";

interface TextInputProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  onBlur?: (e: any) => void;
  onFocus?: (e: any) => void;
  onKeyDown?: (e: any) => void;
}

const TextInput = (props: TextInputProps) => {
  const { disabled, onChange, className, placeholder, maxLength, onBlur, onFocus, onKeyDown } =
    props;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as any).reset();
      }}
      className={clsx(
        "w-full p-2 transition-all duration-300 focus:outline-none  border-opacity-50 focus:border-opacity-100  placeholder-white/25 flex-grow  bg-transparent border border-gold/40 rounded-sm font-bold",
        className,
      )}
    >
      <input
        className={clsx(
          "w-full h-full transition-all duration-300 focus:outline-none  border-opacity-50 focus:border-opacity-100  placeholder-white/25 flex-grow  bg-transparent rounded-sm font-bold",
        )}
        disabled={disabled || false}
        type="text"
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        autoComplete="off"
      />
    </form>
  );
};

export default TextInput;
