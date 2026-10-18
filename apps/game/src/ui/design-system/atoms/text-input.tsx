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
      className={clsx("ui-field w-full flex-grow", className)}
      data-fill
    >
      <input
        ref={ref}
        autoFocus={true}
        className="min-w-0 flex-1"
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
