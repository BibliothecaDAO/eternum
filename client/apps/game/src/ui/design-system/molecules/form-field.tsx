import clsx from "clsx";
import { ReactNode } from "react";

interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  spacing?: "tight" | "normal" | "relaxed";
}

const spacingClassMap = {
  tight: "space-y-1",
  normal: "space-y-2",
  relaxed: "space-y-3",
};

export const FormField = ({
  label,
  htmlFor,
  description,
  error,
  required = false,
  children,
  className,
  spacing = "normal",
}: FormFieldProps) => {
  const labelContent =
    typeof label === "string" && required ? (
      <span>
        {label}
        <span className="ml-1 text-red">*</span>
      </span>
    ) : (
      label
    );

  return (
    <div className={clsx("flex flex-col", spacingClassMap[spacing], className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-gold/90 tracking-wide uppercase">
          {labelContent}
        </label>
      )}
      {description && <p className="text-xs text-gold/60">{description}</p>}
      {children}
      {error && <p className="text-xs text-red/80">{error}</p>}
    </div>
  );
};

export default FormField;
