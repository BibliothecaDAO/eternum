type ToggleProps = {
  label: string;
  checked: boolean;
  children?: React.ReactNode;
  onChange: (checked: boolean) => void;
};

const Toggle = ({ label, checked, onChange }: ToggleProps) => {
  return (
    <label className="relative inline-flex items-center mb-1 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-9 h-5 bg-black peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gold-500 dark:peer-focus:ring-gray rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-gold"></div>
      <span className="ms-1 text-sm font-medium text-gold dark:text-gold text-xxs">{label}</span>
    </label>
  );
};

export default Toggle;
