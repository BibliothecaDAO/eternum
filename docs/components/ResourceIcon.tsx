import { resources } from "../utils/constants";

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
  const imgPath = resources.find((r) => r.id === id)?.img;
  return (
    <div className={`flex self-center justify-center`}>
      <img className={STYLES.size[size]} src={`/resources` + imgPath} alt={name} title={name} />
    </div>
  );
}
