import clsx from "clsx";

interface AvatarProps {
  src: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  onClick?: () => void;
}

const sizes = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-[68px] h-[68px]",
  xxl: "w-[100px] h-[100px]",
} as const;

const Avatar = ({ src, className, size, onClick }: AvatarProps) => {
  return (
    <img
      onClick={onClick}
      draggable={false}
      src={src}
      alt="avatar"
      className={clsx(
        "object-contain rounded-full border border-gold p-1 border-solid transform hover:scale-105 transition-transform duration-100 cursor-pointer hover:opacity-90",
        className,
        size ? sizes[size] : "",
      )}
    />
  );
};

export default Avatar;
