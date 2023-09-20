import clsx from "clsx";

interface TextInputProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
    placeholder?: string;
    maxLength?: number;
    onBlur?: (e: any) => void;
    onFocus?: (e: any) => void;
    onKeyDown?: (e: any) => void;
}

const TextInput = (props: TextInputProps) => {
    const { value, onChange, className, placeholder, maxLength, onBlur, onFocus, onKeyDown } = props;
    return (
        <input
            className={clsx(
                "w-full p-2 h-8 bg-transparent transition-all duration-300 focus:outline-none focus:border-opacity-50 text-white placeholder-white/25 text-xs flex-grow rounded-lg",
                className
            )}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={maxLength}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
        />
    );
};

export default TextInput;
