import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import clsx from "clsx";
type CheckboxProps = {
  enabled: boolean;
  onClick?: () => void;
  text?: string;
};

export const Checkbox = ({ enabled, onClick, text }: CheckboxProps) => (
  <div className="flex flex-row justify-center items-center text-center space-x-2">
    <div
      onClick={onClick}
      className={clsx(
        "w-3 h-3 flex items-center justify-center rounded-[3px] bg-dark-green-accent border transition-all duration-300 ease-in-out hover:border-white",
        enabled ? "border-grey" : "border-gold",
      )}
    >
      {enabled && <Checkmark className="fill-gold" />}
    </div>
    {text && (
      <div onClick={onClick} className="text-sm text-gray-300 hover:text-white transition-colors duration-200">
        {text}
      </div>
    )}
  </div>
);
