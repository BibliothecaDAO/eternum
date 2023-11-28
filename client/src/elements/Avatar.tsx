import clsx from "clsx";

interface AvatarProps {
  src: string;
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
}

const sizes = {
  xs: "w-4 h-4",
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-12 h-12",
  xl: "w-[68px] h-[68px]",
} as const;

const Avatar = ({ src, className, size }: AvatarProps) => {
  return (
    <img
      draggable={false}
      src={src}
      alt="avatar"
      className={clsx(
        "object-contain rounded-full border border-white/40 border-solid",
        className,
        size ? sizes[size] : "",
      )}
    />
  );
};

export default Avatar;
