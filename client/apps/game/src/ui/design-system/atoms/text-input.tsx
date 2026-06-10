import clsx from "clsx";
import React from "react";

interface TextInputProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  value?: string;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>((props, ref) => {
  const { disabled, onChange, value, className, placeholder, maxLength, onBlur, onFocus, onKeyDown } = props;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        (e.target as HTMLFormElement).reset();
      }}
      className={clsx(
        "w-full transition-all duration-300 focus:outline-none border-opacity-50 focus:border-opacity-100 placeholder-white/25 flex-grow bg-transparent btn-bronze rounded-lg",
        className,
      )}
    >
      <input
        ref={ref}
        autoFocus={true}
        className={clsx(
          "w-full p-2 h-full  transition-all duration-300 focus:outline-none border-opacity-50 focus:border-opacity-100 placeholder:text-gold flex-grow bg-transparent",
        )}
        disabled={disabled || false}
        type="text"
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        onBlur={onBlur}
        onFocus={onFocus}
        onKeyDown={(e) => {
          e.stopPropagation(); // Prevent key events from propagating
          if (onKeyDown) onKeyDown(e);
        }}
        autoComplete="off"
      />
    </form>
  );
});

export default TextInput;
