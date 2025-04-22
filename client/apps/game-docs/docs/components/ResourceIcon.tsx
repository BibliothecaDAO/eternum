const STYLES = {
  size: {
    xs: "w-2 h-2 md:w-4 md:h-4",
    sm: "w-4 h-4 md:w-6 md:h-6",
    md: "w-6 h-6",
    lg: "w-8 h-8",
    xl: "w-12 h-12 md:w-16 md:h-16",
    xxl: "w-16 h-16 md:w-20 md:h-20",
  },
} as const;

type Props = {
  name: string;
  id: number | undefined;
  size?: keyof typeof STYLES.size;
};

export default function ResourceIcon({ name, id, size = "xl" }: Props) {
  return (
    <div style={{ display: "flex", alignSelf: "center", justifyContent: "center" }}>
      <img
        style={
          size === "xs"
            ? { width: "0.5rem", height: "0.5rem" }
            : size === "sm"
              ? { width: "1rem", height: "1rem" }
              : size === "md"
                ? { width: "1.5rem", height: "1.5rem" }
                : size === "lg"
                  ? { width: "2rem", height: "2rem" }
                  : size === "xl"
                    ? { width: "3rem", height: "3rem" }
                    : { width: "4rem", height: "4rem" }
        }
        src={`/images/resources/${id}.png`}
        alt={name}
        title={name}
      />
    </div>
  );
}
